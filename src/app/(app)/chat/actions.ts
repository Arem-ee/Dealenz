"use server"

import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { classifyOperation, inferIntent, isGreeting, DETERMINISTIC_GREETING } from "@/lib/conversation/classify"
import { addMessage, createConversation, getConversation, listMessages } from "@/lib/conversation/store"
import { analyzeDeterministic, summarizeAnalysis } from "@/lib/deals/analyze"
import { findCorpusConflicts, segmentClauses, type CorpusClause, type CorpusConflict } from "@/lib/corpus/conflicts"
import { callAIForSurface } from "@/lib/ai/providers"
import { AIProviderError } from "@/lib/ai/errors"
import { detectFindingConflicts } from "@/lib/rules/result"
import type { RuleResult } from "@/lib/rules/result"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  deriveTitle,
  fitMessage,
  isIntakeDealType,
  MAX_INTAKE_FILES,
  MIN_READABLE_CHARS,
  proposeDealType,
  sanitizeStorageName,
  type IntakeDealType,
} from "@/lib/deals/intake"
import { extractTextFromBuffer, isSupportedFileType, isValidFileSize } from "@/lib/text-extract"
import { buildAskPrompt, parseClaimsBlock } from "@/lib/deals/claims"

const AUDIT_FILES_BUCKET = "audit-files"
const MAX_RAW_INPUT_CHARS = 500_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

async function authedUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { supabase, userId: user.id }
}

async function ownedAudit(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, auditId: string) {
  const { data } = await supabase
    .from("audits")
    .select("id, title, deal_type, raw_input, structured_data, updated_at")
    .eq("id", auditId)
    .eq("user_id", userId)
    .maybeSingle()
  return (data as { id: string; title: string | null; deal_type: string | null; raw_input: string | null; structured_data?: unknown; updated_at: string } | null) ?? null
}

const LOCKED_VERSION_STATUSES = ["locked", "fully_signed", "superseded"]

/**
 * Indexes a deal's signed versions into the corpus (idempotent per
 * version). Best-effort: a missing table (migration 00093 unapplied) or
 * any failure skips silently and analysis proceeds without corpus
 * coverage — never blocking, never loud about infrastructure.
 */
async function indexDealCorpus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  auditId: string
): Promise<void> {
  try {
    const { data: versions, error } = await supabase
      .from("document_versions")
      .select("id, content")
      .eq("audit_id", auditId)
      .eq("user_id", userId)
      .in("status", LOCKED_VERSION_STATUSES)
    if (error || !versions) return
    const rows = versions as Array<{ id: string; content: string | null }>
    if (rows.length === 0) return
    const { data: existing } = await supabase
      .from("corpus_clauses")
      .select("version_id")
      .eq("audit_id", auditId)
      .eq("user_id", userId)
    const done = new Set(((existing ?? []) as Array<{ version_id: string | null }>).map((r) => r.version_id))
    const inserts: Array<Record<string, unknown>> = []
    for (const v of rows) {
      if (done.has(v.id) || typeof v.content !== "string" || v.content.length < 20) continue
      for (const s of segmentClauses(v.content)) {
        inserts.push({
          user_id: userId,
          audit_id: auditId,
          version_id: v.id,
          clause_key: s.key,
          title: s.title,
          quote: s.quote,
          text_hash: s.textHash,
        })
      }
    }
    if (inserts.length === 0) return
    await supabase.from("corpus_clauses").insert(inserts)
  } catch {
    // Corpus indexing never breaks analysis.
  }
}

async function loadCorpusFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  excludeAuditId: string
): Promise<CorpusClause[]> {
  try {
    const { data, error } = await supabase
      .from("corpus_clauses")
      .select("audit_id, clause_key, title, quote")
      .eq("user_id", userId)
      .neq("audit_id", excludeAuditId)
      .order("created_at", { ascending: false })
      .limit(200)
    if (error || !data) return []
    const rows = data as Array<{ audit_id: string; clause_key: string; title: string; quote: string }>
    const titles = new Map<string, string>()
    const ids = [...new Set(rows.map((r) => r.audit_id))]
    if (ids.length > 0) {
      const { data: audits } = await supabase.from("audits").select("id, title").eq("user_id", userId).in("id", ids)
      for (const a of ((audits ?? []) as Array<{ id: string; title: string | null }>)) {
        titles.set(a.id, a.title?.trim() ? a.title : "Untitled")
      }
    }
    return rows.map((r) => ({
      auditId: r.audit_id,
      auditTitle: titles.get(r.audit_id) ?? "Untitled",
      clauseKey: r.clause_key,
      title: r.title,
      quote: r.quote,
    }))
  } catch {
    return []
  }
}

/**
 * Automatic deterministic analysis. Runs on material — never gated, never
 * billed per action. Findings persist to the audit and post as an
 * assistant message. Failures post honestly instead of staying silent.
 */
async function runAnalysisForAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  audit: { id: string; deal_type: string | null; raw_input: string | null },
  threadId: string | null
): Promise<void> {
  const raw = (audit.raw_input ?? "").trim()
  if (raw.length < 20) return
  let resolvedThreadId = threadId
  if (!resolvedThreadId) {
    const { data } = await supabase
      .from("conversations")
      .select("id")
      .eq("attached_audit_id", audit.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    resolvedThreadId = (data as { id: string } | null)?.id ?? null
  }
  try {
    const evaluatedAt = new Date().toISOString()
    const out = analyzeDeterministic(audit.deal_type ?? "generic", raw, audit.id, evaluatedAt)
    await indexDealCorpus(supabase, userId, audit.id)
    const corpus = await loadCorpusFor(supabase, userId, audit.id)
    const conflicts: CorpusConflict[] = findCorpusConflicts(raw, corpus, audit.id)
    const { data: current } = await supabase
      .from("audits")
      .select("structured_data")
      .eq("id", audit.id)
      .eq("user_id", userId)
      .maybeSingle()
    const existing = ((current as { structured_data?: unknown } | null)?.structured_data ?? {}) as Record<string, unknown>
    await supabase
      .from("audits")
      .update({ structured_data: { ...existing, deterministicFindings: out.results, corpusConflicts: conflicts, analysisEvaluatedAt: evaluatedAt } })
      .eq("id", audit.id)
      .eq("user_id", userId)
    if (resolvedThreadId) {
      const summary = conflicts.length > 0
        ? `${summarizeAnalysis(out)} Plus ${conflicts.length} cross-contract conflict${conflicts.length === 1 ? "" : "s"} against your other deals — see below.`
        : summarizeAnalysis(out)
      await addMessage(supabase as never, {
        conversationId: resolvedThreadId,
        userId,
        role: "assistant",
        content: summary,
        operation: "document_analysis",
        intent: "review",
        metadata: {
          type: "analysis_complete",
          failCount: out.fails.length,
          unknownCount: out.unknowns.length,
          conflictCount: conflicts.length,
          evaluatedAt,
        },
      })
    }
  } catch {
    if (resolvedThreadId) {
      await addMessage(supabase as never, {
        conversationId: resolvedThreadId,
        userId,
        role: "assistant",
        content: "Analysis couldn't run on that material — your text is saved. New material retries it automatically.",
        operation: "document_analysis",
        intent: "review",
        metadata: { type: "analysis_failed" },
      }).catch(() => undefined)
    }
  }
}

/**
 * Slice-one creation: text (and optionally a confirmed deal type) mints an
 * audit plus its thread and first messages. The assistant message records
 * the classifier's visible shot — operation, intent, proposed type — with
 * one-tap correction in the thread. Analysis runs automatically next.
 */
export async function createDeal(input: { text: string; dealType?: string; valueAmount?: string; valueCurrency?: string }): Promise<
  | ActionOk<{ threadId: string; auditId: string; operation: string; intent: string; dealType: IntakeDealType }>
  | ActionFail
> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const text = input.text.trim()
  if (!text) return { ok: false, error: "Describe the deal first." }
  if (isGreeting(text)) {
    return { ok: false, error: "Say hello back instead — greetings never become deals." }
  }
  const dealType: IntakeDealType = isIntakeDealType(input.dealType) ? input.dealType : proposeDealType(text)
  const operation = classifyOperation(text, false)
  const intent = inferIntent(text, operation)
  const raw = text.length > MAX_RAW_INPUT_CHARS ? `${text.slice(0, MAX_RAW_INPUT_CHARS).trimEnd()}…(truncated)` : text

  let valueMinor: number | null = null
  let valueCurrency: string | null = null
  let envelope: Record<string, unknown> | null = null
  if ((input.valueAmount ?? "").trim() !== "" || (input.valueCurrency ?? "").trim() !== "") {
    const { parseDealValue } = await import("@/lib/deals/value")
    const parsed = parseDealValue({ amount: input.valueAmount ?? "", currency: input.valueCurrency ?? "" })
    if ("error" in parsed) return { ok: false, error: parsed.error }
    const { envelopeWithValue } = await import("@/lib/deals/value")
    const { emptyContextEnvelope } = await import("@/lib/context/schema")
    const built = envelopeWithValue(emptyContextEnvelope(), parsed.minor, parsed.currency)
    envelope = JSON.parse(JSON.stringify(built)) as Record<string, unknown>
    valueMinor = parsed.minor
    valueCurrency = parsed.currency
  }

  const { data: audit, error: auditError } = await supabase
    .from("audits")
    .insert({
      user_id: userId,
      title: deriveTitle(text),
      deal_type: dealType,
      raw_input: raw,
      ...(envelope ? { context_envelope: envelope as never, context_version: 1 } : {}),
      ...(valueMinor !== null ? { deal_value_minor: valueMinor, deal_value_currency: valueCurrency } : {}),
    })
    .select("id")
    .single()
  if (auditError || !audit) return { ok: false, error: "We couldn't start that deal. Please try again." }
  const auditId = (audit as { id: string }).id

  try {
    const thread = await createConversation(supabase as never, userId, { attachedAuditId: auditId, firstText: text })
    const fitted = fitMessage(text)
    await addMessage(supabase as never, {
      conversationId: thread.id,
      userId,
      role: "user",
      content: fitted.content,
      operation,
      intent,
      metadata: fitted.truncated ? { truncated: true } : {},
    })
    await addMessage(supabase as never, {
      conversationId: thread.id,
      userId,
      role: "assistant",
      content: `Looks like ${operation} · ${dealType}. Correct it below if I read it wrong — analysis runs automatically.`,
      operation,
      intent,
      metadata: { type: "routing_shot", operation, intent, dealType },
    })
    await runAnalysisForAudit(supabase, userId, { id: auditId, deal_type: dealType, raw_input: raw }, thread.id)
    return { ok: true, threadId: thread.id, auditId, operation, intent, dealType }
  } catch {
    await supabase.from("audits").delete().eq("id", auditId).eq("user_id", userId)
    return { ok: false, error: "We couldn't start that deal. Please try again." }
  }
}

/** Append follow-up material to a deal: extends raw_input, posts the turn. */
export async function appendMaterial(input: { threadId: string; text: string }): Promise<
  ActionOk<{ auditId: string }> | ActionFail
> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const text = input.text.trim()
  if (!text) return { ok: false, error: "Describe the deal first." }
  const thread = await getConversation(supabase as never, userId, input.threadId).catch(() => null)
  if (!thread?.attached_audit_id) return { ok: false, error: "That thread has no deal attached." }
  const audit = await ownedAudit(supabase, userId, thread.attached_audit_id)
  if (!audit) return { ok: false, error: "Deal not found." }

  const combined = `${audit.raw_input ?? ""}\n\n--- Added material ---\n${text}`.slice(-MAX_RAW_INPUT_CHARS)
  const { error } = await supabase.from("audits").update({ raw_input: combined }).eq("id", audit.id).eq("user_id", userId)
  if (error) return { ok: false, error: "We couldn't save that. Please try again." }
  const fitted = fitMessage(text)
  await addMessage(supabase as never, {
    conversationId: thread.id,
    userId,
    role: "user",
    content: fitted.content,
    metadata: fitted.truncated ? { truncated: true, appended: true } : { appended: true },
  })
  await runAnalysisForAudit(supabase, userId, { id: audit.id, deal_type: audit.deal_type, raw_input: combined }, thread.id)
  return { ok: true, auditId: audit.id }
}

/** One-tap correction of the classifier's proposed deal type. */
export async function correctDealType(input: { auditId: string; dealType: string }): Promise<
  ActionOk<{ saved: boolean }> | ActionFail
> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed
  if (!isIntakeDealType(input.dealType)) return { ok: false, error: "Unknown deal type." }
  const { error } = await supabase.from("audits").update({ deal_type: input.dealType }).eq("id", input.auditId).eq("user_id", userId)
  if (error) return { ok: false, error: "We couldn't save that. Please try again." }
  const updated = await ownedAudit(supabase, userId, input.auditId)
  if (updated) {
    await runAnalysisForAudit(supabase, userId, { id: updated.id, deal_type: updated.deal_type, raw_input: updated.raw_input }, null)
  }
  return { ok: true, saved: true }
}

export interface CorpusConflictView {
  type: string
  message: string
  auditId: string
  auditTitle: string
  clauseTitle: string
  quote: string
}

export interface FindingView {
  ruleKey: string
  severity: string
  summary: string
  guidance: string | null
}

export interface ThreadView {
  threadId: string
  title: string
  auditId: string | null
  shared: boolean
  scope: "owner" | "viewer" | "commenter" | "asker" | "participant"
  currentUserId: string
  dealType: string | null
  dealValueMinor: number | null
  dealValueCurrency: string | null
  operation: string | null
  intent: string | null
  findings: FindingView[]
  corpusConflicts: CorpusConflictView[]
  messages: Array<{ id: string; userId: string; role: "user" | "assistant"; content: string; created_at: string; metadata: Record<string, unknown> }>
}

/** Load a thread for the workspace: audit, shot state, messages. */
export async function getThread(threadId: string): Promise<ActionOk<{ thread: ThreadView }> | ActionFail> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const thread = await getConversation(supabase as never, userId, threadId).catch(() => null)
  // Shared leg: the conversation query above is owner-scoped, so a deal
  // shared with the caller's group loads here instead — conversation and
  // messages by id (RLS admits group members), audit through the shared
  // union below. Anything else stays "not found".
  let sharedThread: { id: string; title: string; attached_audit_id: string | null } | null = null
  if (!thread) {
    const { data: convo } = await supabase
      .from("conversations")
      .select("id, title, attached_audit_id")
      .eq("id", threadId)
      .maybeSingle()
    const c = convo as { id: string; title: string; attached_audit_id: string | null } | null
    if (c?.attached_audit_id) {
      const { sharedAuditIds } = await import("@/lib/deals/shares")
      const visible = await sharedAuditIds(supabase, userId)
      if (visible.includes(c.attached_audit_id)) {
        sharedThread = c
      }
    }
    if (!sharedThread) return { ok: false, error: "Thread not found." }
  }
  const activeThreadId = thread?.id ?? (sharedThread as { id: string }).id
  const messages = thread
    ? await listMessages(supabase as never, userId, threadId, 50).catch(() => [])
    : await supabase
        .from("conversation_messages")
        .select("id, conversation_id, user_id, role, content, operation, intent, objective, message_type, metadata, created_at")
        .eq("conversation_id", threadId)
        .order("created_at", { ascending: true })
        .limit(50)
        .then(
          (r) => (r.data ?? []) as Array<{ id: string; user_id: string; role: "user" | "assistant"; content: string; created_at: string; metadata: Record<string, unknown> }>,
          () => [] as Array<{ id: string; user_id: string; role: "user" | "assistant"; content: string; created_at: string; metadata: Record<string, unknown> }>
        )
  type AuditThreadRow = { id: string; title: string | null; deal_type: string | null; structured_data?: unknown; deal_value_minor?: number | null; deal_value_currency?: string | null }
  let audit: AuditThreadRow | null = null
  let shared = false
  const activeThread = thread ?? sharedThread
  const activeAuditId = activeThread?.attached_audit_id ?? null
  if (activeAuditId) {
    const { data } = await supabase
      .from("audits")
      .select("id, title, deal_type, structured_data, deal_value_minor, deal_value_currency")
      .eq("id", activeAuditId)
      .eq("user_id", userId)
      .maybeSingle()
    audit = (data as AuditThreadRow | null) ?? null
    if (!audit) {
      // Shared leg: RLS admits the audit, conversation, and messages to
      // group members; every mutation below keeps its user_id chain and
      // stays owner-only. Fail-closed: anything else is "not found".
      const { sharedAuditIds } = await import("@/lib/deals/shares")
      const visible = await sharedAuditIds(supabase, userId)
      if (visible.includes(activeAuditId)) {
        const { data: sharedAudit } = await supabase
          .from("audits")
          .select("id, title, deal_type, structured_data, deal_value_minor, deal_value_currency")
          .eq("id", activeAuditId)
          .maybeSingle()
        audit = (sharedAudit as AuditThreadRow | null) ?? null
        shared = audit !== null
      }
    }
  }
  const shot = [...messages].reverse().find((m) => (m.metadata as Record<string, unknown>)?.type === "routing_shot")
  const shotMeta = (shot?.metadata ?? {}) as Record<string, unknown>
  const rawFindings = ((audit?.structured_data ?? {}) as { deterministicFindings?: unknown }).deterministicFindings
  const findings: FindingView[] = (Array.isArray(rawFindings) ? rawFindings : [])
    .filter((r): r is { ruleKey: string; status: string; finding?: { severity?: string; summary?: string; guidance?: string } } =>
      typeof r === "object" && r !== null && (r as { status?: string }).status === "FAIL")
    .map((r) => ({
      ruleKey: r.ruleKey,
      severity: r.finding?.severity ?? "attention",
      summary: r.finding?.summary ?? r.ruleKey,
      guidance: r.finding?.guidance ?? null,
    }))
  const rawConflicts = ((audit?.structured_data ?? {}) as { corpusConflicts?: unknown }).corpusConflicts
  // Leakage guard: persisted conflicts name the owner's OTHER deals
  // (titles + quotes). Shared viewers see none of that — the section
  // reads "your other deals," which is false for them. Owners unaffected.
  const corpusConflicts: CorpusConflictView[] = shared ? [] : (Array.isArray(rawConflicts) ? rawConflicts : [])
    .filter((c): c is { type: string; message: string; auditId: string; auditTitle: string; clauseTitle: string; quote: string } =>
      typeof c === "object" && c !== null && typeof (c as { message?: unknown }).message === "string")
    .map((c) => ({
      type: c.type,
      message: c.message,
      auditId: c.auditId,
      auditTitle: c.auditTitle,
      clauseTitle: c.clauseTitle,
      quote: c.quote,
    }))
  return {
    ok: true,
    thread: {
      threadId: activeThreadId,
      title: (thread ?? sharedThread)?.title ?? "Thread",
      auditId: audit?.id ?? null,
      shared,
      scope: !audit ? "owner" : shared
        ? await import("@/lib/deals/shares").then(async ({ sharedScope }) =>
            (await sharedScope(supabase, userId, (audit as { id: string }).id).catch(() => null)) ?? "viewer"
          )
        : "owner",
      currentUserId: userId,
      dealType: audit?.deal_type ?? (typeof shotMeta.dealType === "string" ? shotMeta.dealType : null),
      dealValueMinor: audit?.deal_value_minor ?? null,
      dealValueCurrency: audit?.deal_value_currency ?? null,
      operation: typeof shotMeta.operation === "string" ? shotMeta.operation : null,
      intent: typeof shotMeta.intent === "string" ? shotMeta.intent : null,
      findings,
      corpusConflicts,
      messages: messages.map((m) => ({
        id: m.id,
        userId: (m as { user_id?: string }).user_id ?? "",
        role: m.role,
        content: m.content,
        created_at: m.created_at,
        metadata: m.metadata,
      })),
    },
  }
}

export interface MintedUpload {
  name: string
  path: string
  signedUrl: string
}

/**
 * Signed upload URLs for staged files. Server validates type/size/count
 * before minting; the client PUTs bytes directly with progress, then calls
 * attachFiles to validate content and land the text.
 */
export async function mintUploadUrls(input: {
  auditId: string
  files: Array<{ name: string; size: number; mime: string }>
}): Promise<ActionOk<{ uploads: MintedUpload[] }> | ActionFail> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const audit = await ownedAudit(supabase, userId, input.auditId)
  if (!audit) return { ok: false, error: "Deal not found." }
  if (input.files.length === 0 || input.files.length > MAX_INTAKE_FILES) {
    return { ok: false, error: `Attach between 1 and ${MAX_INTAKE_FILES} files.` }
  }
  const uploads: MintedUpload[] = []
  for (const f of input.files) {
    if (f.size <= 0 || !isValidFileSize(f.size)) {
      return { ok: false, error: `"${f.name}" exceeds the 10MB limit.` }
    }
    if (!isSupportedFileType(f.mime)) {
      return { ok: false, error: `"${f.name}" is not a PDF, Word, or text file.` }
    }
    const path = `${userId}/${audit.id}/${randomUUID()}-${sanitizeStorageName(f.name)}`
    const { data, error } = await supabase.storage.from(AUDIT_FILES_BUCKET).createSignedUploadUrl(path)
    if (error || !data?.signedUrl) {
      return { ok: false, error: `We couldn't stage "${f.name}". Please try again.` }
    }
    uploads.push({ name: f.name, path, signedUrl: data.signedUrl })
  }
  return { ok: true, uploads }
}

export interface AttachResult {
  name: string
  ok: boolean
  chars?: number
  error?: string
}

/**
 * Finalize staged uploads: download, re-validate bytes server-side,
 * extract text, enforce the parseability gate, append readable text to
 * the deal. Unreadable files are removed and reported per file — one bad
 * file never kills the rest.
 */
export async function attachFiles(input: {
  auditId: string
  files: Array<{ name: string; path: string }>
}): Promise<ActionOk<{ results: AttachResult[] }> | ActionFail> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const audit = await ownedAudit(supabase, userId, input.auditId)
  if (!audit) return { ok: false, error: "Deal not found." }

  const results: AttachResult[] = []
  const additions: string[] = []
  for (const f of input.files) {
    if (!f.path.startsWith(`${userId}/${audit.id}/`)) {
      results.push({ name: f.name, ok: false, error: `"${f.name}" doesn't belong to this deal.` })
      continue
    }
    const { data: blob, error: dlError } = await supabase.storage.from(AUDIT_FILES_BUCKET).download(f.path)
    if (dlError || !blob) {
      results.push({ name: f.name, ok: false, error: `"${f.name}" didn't arrive. Retry the upload.` })
      continue
    }
    const buffer = Buffer.from(await blob.arrayBuffer())
    let text: string
    try {
      text = await extractTextFromBuffer(buffer, detectMime(f.name, buffer))
    } catch (err) {
      await supabase.storage.from(AUDIT_FILES_BUCKET).remove([f.path])
      results.push({
        name: f.name,
        ok: false,
        error: err instanceof Error ? `"${f.name}": ${err.message}` : `"${f.name}" couldn't be read and was removed.`,
      })
      continue
    }
    if (text.trim().length < MIN_READABLE_CHARS) {
      await supabase.storage.from(AUDIT_FILES_BUCKET).remove([f.path])
      results.push({ name: f.name, ok: false, error: `"${f.name}" has no readable text and was removed — scanned images need OCR first.` })
      continue
    }
    additions.push(`\n\n--- ${f.name} ---\n${text.trim().slice(0, MAX_RAW_INPUT_CHARS)}`)
    results.push({ name: f.name, ok: true, chars: text.trim().length })
  }

  if (additions.length > 0) {
    const combined = `${audit.raw_input ?? ""}${additions.join("")}`.slice(-MAX_RAW_INPUT_CHARS)
    await supabase.from("audits").update({ raw_input: combined }).eq("id", audit.id).eq("user_id", userId)
    await runAnalysisForAudit(supabase, userId, { id: audit.id, deal_type: audit.deal_type, raw_input: combined }, null)
  }
  return { ok: true, results }
}

function detectMime(name: string, buffer: Buffer): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (buffer.subarray(0, 5).toString("binary") === "%PDF-") return "application/pdf"
  if (buffer.subarray(0, 2).toString("hex") === "504b") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  if (ext === "txt") return "text/plain"
  if (ext === "pdf") return "application/pdf"
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  return "text/plain"
}

const ASK_HISTORY_TURNS = 6
const ASK_PROMPT_CHARS = 4000
const ASK_MATERIAL_CHARS = 12000

interface AskFinding {
  ruleKey: string
  status: string
  severity: string
  summary: string
  guidance: string | null
  evidenceQuote: string | null
}

/**
 * Ask a question about the deal. Grounded answers with cited sources;
 * verdicts validated against deterministic findings (flips are retried
 * once, then fall back to deterministic truth). Rate-capped per day —
 * abuse control, never a price. Provider failures post honestly.
 */
export async function askQuestion(input: { threadId: string; text: string; modelChoice?: { keyId: string; model: string } | null }): Promise<
  ActionOk<{ answer: string }> | ActionFail
> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const question = input.text.trim()
  if (!question) return { ok: false, error: "Ask a question first." }
  const thread = await getConversation(supabase as never, userId, input.threadId).catch(() => null)
  if (!thread?.attached_audit_id) return { ok: false, error: "That thread has no deal attached." }
  const audit = await ownedAudit(supabase, userId, thread.attached_audit_id)
  if (!audit) return { ok: false, error: "Deal not found." }

  const operation = classifyOperation(question, true)
  const intent = inferIntent(question, operation)

  const postUserTurn = async () => {
    const fitted = fitMessage(question)
    await addMessage(supabase as never, {
      conversationId: thread.id,
      userId,
      role: "user",
      content: fitted.content,
      operation,
      intent,
      metadata: fitted.truncated ? { truncated: true } : {},
    })
  }

  // Deterministic greeting: no AI, no cap consumed, no findings lookup.
  if (isGreeting(question)) {
    await postUserTurn()
    await addMessage(supabase as never, {
      conversationId: thread.id,
      userId,
      role: "assistant",
      content: DETERMINISTIC_GREETING,
      operation,
      intent,
      metadata: { type: "ask_answer", deterministic: true },
    })
    return { ok: true, answer: DETERMINISTIC_GREETING }
  }

  const cap = await checkRateLimit("ask_turn")
  if (!cap.allowed) {
    await postUserTurn()
    const msg = cap.error ?? "You've reached today's question limit. Please try again tomorrow."
    await addMessage(supabase as never, {
      conversationId: thread.id,
      userId,
      role: "assistant",
      content: msg,
      operation,
      intent,
      metadata: { type: "ask_rate_limited" },
    })
    return { ok: true, answer: msg }
  }

  const rawFindings = (audit.structured_data as { deterministicFindings?: unknown } | null | undefined)?.deterministicFindings
  const stored = (Array.isArray(rawFindings) ? rawFindings : []) as RuleResult[]
  const valid = (r: RuleResult) => r.status === "FAIL" || r.status === "PASS" || r.status === "UNKNOWN"
  const fails = stored.filter((r) => r.status === "FAIL")
  const findings: AskFinding[] = fails.slice(0, 8).map((r) => ({
    ruleKey: r.ruleKey,
    status: r.status,
    severity: r.finding?.severity ?? "attention",
    summary: r.finding?.summary ?? r.ruleKey,
    guidance: r.finding?.guidance ?? null,
    evidenceQuote: r.finding?.evidence?.[0]?.quote?.slice(0, 200) ?? null,
  }))
  const historyRows = await listMessages(supabase as never, userId, thread.id, ASK_HISTORY_TURNS + 1).catch(() => [])
  const history = historyRows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-ASK_HISTORY_TURNS)
    .map((m) => ({ role: m.role, text: m.content.slice(0, 1000) }))

  await postUserTurn()

  const material = (audit.raw_input ?? "").trim().slice(0, ASK_MATERIAL_CHARS)
  const dealType = audit.deal_type ?? "generic"

  // Standing positions: the workspace playbook, scoped to this deal.
  // Applied to every answer and quoted when used — never silent.
  let standingBlock: string | null = null
  try {
    const { data: positionRows } = await supabase
      .from("standing_instructions")
      .select("text, deal_types")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
    const standing = await import("@/lib/standing/rules")
    const scoped = ((positionRows ?? []) as Array<{ text: string; deal_types: unknown }>)
      .filter((r) => standing.ruleAppliesToDeal(standing.normalizeRuleDealTypes(r.deal_types), dealType))
      .map((r) => r.text)
    standingBlock = standing.formatStandingBlock(scoped)
  } catch {
    standingBlock = null
  }

  // BYOK choice: resolve the user's key (owned, unrevoked, model allowlisted
  // on the key) and run the call against it. Anything off returns an honest
  // error before any provider traffic — never a silent system-model swap.
  let byok: { provider: "anthropic" | "openai_compatible" | "gemini"; apiKey: string; model: string; baseUrl: string | null; keyId: string } | null = null
  if (input.modelChoice) {
    const { loadActiveKey } = await import("@/lib/models/store")
    try {
      const resolved = await loadActiveKey(supabase as never, userId, input.modelChoice.keyId)
      const wanted = input.modelChoice.model.trim()
      if (!resolved.models.includes(wanted)) {
        return { ok: false, error: "That model isn't enabled on the chosen key — check it in Settings." }
      }
      byok = { provider: resolved.provider, apiKey: resolved.apiKey, model: wanted, baseUrl: resolved.base_url, keyId: resolved.id }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "That key isn't available." }
    }
  }

  const markKey = async (error: string | null) => {
    if (!byok) return
    const { touchKeyUsed } = await import("@/lib/models/store")
    await touchKeyUsed(supabase as never, userId, byok.keyId, error)
  }

  // Response language (i18n D4): the profile locale steers prose only —
  // findings, rules, and verdicts stay English. Best-effort, English gap.
  let langInstruction = ""
  try {
    const { data: profile } = await supabase
      .from("business_profiles")
      .select("locale")
      .eq("user_id", userId)
      .maybeSingle()
    const { responseLanguageInstruction } = await import("@/lib/ai/language")
    langInstruction = responseLanguageInstruction((profile as { locale?: unknown } | null)?.locale)
  } catch {
    langInstruction = ""
  }

  const attempt = async (correction?: string) => {
    const { systemPrompt, userContent } = buildAskPrompt({
      question: correction ? `${question}\n\nCorrection to apply: ${correction}` : question,
      dealType,
      material: material || "(no material recorded yet)",
      findings,
      history,
      standing: standingBlock,
    })
    const localizedSystem = `${systemPrompt}${langInstruction}`
    if (byok) {
      const { runWithUserKey } = await import("@/lib/models/run")
      const res = await runWithUserKey({
        provider: byok.provider,
        apiKey: byok.apiKey,
        model: byok.model,
        baseUrl: byok.baseUrl,
        systemPrompt: localizedSystem,
        userContent: userContent.slice(0, ASK_MATERIAL_CHARS + ASK_PROMPT_CHARS),
        temperature: 0.2,
        maxTokens: 1200,
      })
      return { text: res.text, model: `${res.provider}/${res.model} (your key)`, provider: res.provider, usage: res.usage }
    }
    const res = await callAIForSurface("authenticated", {
      systemPrompt: localizedSystem,
      userContent: userContent.slice(0, ASK_MATERIAL_CHARS + ASK_PROMPT_CHARS),
      temperature: 0.2,
      maxTokens: 1200,
    })
    return { text: res.text, model: res.meta.primary.model, provider: res.meta.primary.provider, usage: res.meta.usage }
  }

  let answer: string
  let model = "(unknown)"
  let measuredUsage: { inputTokens: number; outputTokens: number } | undefined
  const turnStart = Date.now()
  try {
    const first = await attempt()
    model = first.model
    measuredUsage = first.usage
    const parsed = parseClaimsBlock(first.text)
    const conflicts = detectFindingConflicts(stored.filter(valid), parsed.claims)
    if (conflicts.length === 0) {
      answer = parsed.clean || first.text.trim()
    } else {
      const second = await attempt(`Your verdicts conflict with the deterministic findings: ${conflicts.join(" ")} Restate without contradicting them, or ask one targeted question.`)
      model = second.model
      if (second.usage) {
        measuredUsage = {
          inputTokens: (measuredUsage?.inputTokens ?? 0) + second.usage.inputTokens,
          outputTokens: (measuredUsage?.outputTokens ?? 0) + second.usage.outputTokens,
        }
      }
      const reparsed = parseClaimsBlock(second.text)
      const stillBad = detectFindingConflicts(stored.filter(valid), reparsed.claims)
      answer = stillBad.length === 0
        ? (reparsed.clean || second.text.trim())
        : `I couldn't verify that against your deal's findings, so here is what they do say:\n${fails.slice(0, 5).map((f) => `• ${f.finding?.summary ?? f.ruleKey}`).join("\n") || "No risky patterns recorded."}`
    }
  } catch (err) {
    const isKeyAuth = byok && err instanceof AIProviderError && (err.category === "auth" || err.category === "config")
    if (byok) {
      await markKey(err instanceof Error ? err.message.slice(0, 200) : "call failed").catch(() => undefined)
    }
    const msg = isKeyAuth
      ? "That key was rejected by its provider — check it in Settings, or ask again on Auto."
      : err instanceof AIProviderError
        ? err.category === "config" || err.category === "auth"
          ? "Ask is unavailable right now — the AI service isn't configured. Your deal and findings are intact; please try again later."
          : "I couldn't reach the AI service. Your question is saved — ask again to retry."
        : "Ask failed. Your question is saved — try again."
    await addMessage(supabase as never, {
      conversationId: thread.id,
      userId,
      role: "assistant",
      content: msg,
      operation,
      intent,
      metadata: { type: "ask_failed" },
    })
    return { ok: true, answer: msg }
  }

  await addMessage(supabase as never, {
    conversationId: thread.id,
    userId,
    role: "assistant",
    content: answer,
    operation,
    intent,
    metadata: { type: "ask_answer", model, operation, intent },
  })
  if (byok) {
    await markKey(null).catch(() => undefined)
  }
  // Internal metering for the future allowance pool: measured tokens only,
  // never a user-facing price.
  {
    const { logEvent } = await import("@/lib/logger")
    await logEvent({
      audit_id: thread.attached_audit_id,
      user_id: userId,
      phase: "ask_turn",
      status: "success",
      duration_ms: Date.now() - turnStart,
      metadata: {
        model,
        inputTokens: measuredUsage?.inputTokens ?? -1,
        outputTokens: measuredUsage?.outputTokens ?? -1,
      },
    }).catch(() => undefined)
  }
  return { ok: true, answer }
}

/**
 * Shared comment: a zero-AI remark on a shared thread. Owners post
 * through the normal composer; this path serves group members holding
 * commenter/participant scope. Never triggers analysis, never mutates
 * the audit — one user row with a shared marker.
 */
export async function postSharedComment(input: { threadId: string; text: string }): Promise<
  ActionOk<{ messageId: string }> | ActionFail
> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const text = input.text.trim()
  if (!text) return { ok: false, error: "Write a comment first." }
  if (!UUID_RE.test(input.threadId)) return { ok: false, error: "Invalid thread." }
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, attached_audit_id")
    .eq("id", input.threadId)
    .maybeSingle()
  const thread = convo as { id: string; attached_audit_id: string | null } | null
  if (!thread?.attached_audit_id) return { ok: false, error: "That thread has no deal attached." }
  const audit = await ownedAudit(supabase, userId, thread.attached_audit_id)
  if (!audit) {
    const { sharedAuditIds, sharedScope } = await import("@/lib/deals/shares")
    const visible = await sharedAuditIds(supabase, userId)
    if (!visible.includes(thread.attached_audit_id)) return { ok: false, error: "Thread not found." }
    const scope = await sharedScope(supabase, userId, thread.attached_audit_id)
    if (scope !== "commenter" && scope !== "participant") {
      return { ok: false, error: "Your access on this deal is read-only." }
    }
  }
  const fitted = fitMessage(text)
  try {
    const row = await addMessage(supabase as never, {
      conversationId: thread.id,
      userId,
      role: "user",
      content: fitted.content,
      metadata: { type: "shared_comment", shared: true, ...(fitted.truncated ? { truncated: true } : {}) },
    })
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        const { createClient: createServiceClient } = await import("@supabase/supabase-js")
        const { notifyDealOwner } = await import("@/lib/notifications/notify")
        await notifyDealOwner(createServiceClient(url, key), thread.attached_audit_id, {
          type: "status",
          title: "New comment on your deal",
          body: "A group member commented — open the thread to read it.",
          link: `/chat/${thread.id}`,
        })
      }
    } catch {
      // The comment stands regardless; the notification is best-effort.
    }
    return { ok: true, messageId: row.id }
  } catch {
    return { ok: false, error: "We couldn't post that comment." }
  }
}

/**
 * Shared ask: a group member's question on a shared deal. Metering-only
 * like owner Ask (no priced policy), rate-capped per reader BEFORE any
 * write — denied turns write nothing. Grounded on this deal's findings
 * only: no corpus cross-deal, no standing rules (those are the owner's).
 * Writes user + assistant rows with a shared marker; never analysis.
 */
export async function askSharedQuestion(input: { threadId: string; text: string }): Promise<
  ActionOk<{ answer: string }> | ActionFail
> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const question = input.text.trim()
  if (!question) return { ok: false, error: "Ask a question first." }
  if (!UUID_RE.test(input.threadId)) return { ok: false, error: "Invalid thread." }
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, attached_audit_id")
    .eq("id", input.threadId)
    .maybeSingle()
  const thread = convo as { id: string; attached_audit_id: string | null } | null
  if (!thread?.attached_audit_id) return { ok: false, error: "That thread has no deal attached." }
  const owned = await ownedAudit(supabase, userId, thread.attached_audit_id)
  if (!owned) {
    const { sharedAuditIds, sharedScope } = await import("@/lib/deals/shares")
    const visible = await sharedAuditIds(supabase, userId)
    if (!visible.includes(thread.attached_audit_id)) return { ok: false, error: "Thread not found." }
    const scope = await sharedScope(supabase, userId, thread.attached_audit_id)
    if (scope !== "asker" && scope !== "participant") {
      return { ok: false, error: "Your access on this deal is read-only." }
    }
  }
  const { data: auditRow } = await supabase
    .from("audits")
    .select("id, deal_type, raw_input, structured_data")
    .eq("id", thread.attached_audit_id)
    .maybeSingle()
  const audit = auditRow as {
    id: string; deal_type: string | null; raw_input: string | null;
    structured_data: { deterministicFindings?: unknown } | null;
  } | null
  if (!audit) return { ok: false, error: "Deal not found." }

  const operation = classifyOperation(question, true)
  const intent = inferIntent(question, operation)

  // Rate gate FIRST: denied turns write nothing (unlike the owner path's
  // post-then-check order, which this path deliberately does not copy).
  const cap = await checkRateLimit("ask_turn")
  if (!cap.allowed) {
    return { ok: false, error: cap.error ?? "You've reached today's question limit. Please try again tomorrow." }
  }

  const rawFindings = audit.structured_data?.deterministicFindings
  const stored = (Array.isArray(rawFindings) ? rawFindings : []) as RuleResult[]
  const valid = (r: RuleResult) => r.status === "FAIL" || r.status === "PASS" || r.status === "UNKNOWN"
  const fails = stored.filter((r) => r.status === "FAIL")
  const findings: AskFinding[] = fails.slice(0, 8).map((r) => ({
    ruleKey: r.ruleKey,
    status: r.status,
    severity: r.finding?.severity ?? "attention",
    summary: r.finding?.summary ?? r.ruleKey,
    guidance: r.finding?.guidance ?? null,
    evidenceQuote: r.finding?.evidence?.[0]?.quote?.slice(0, 200) ?? null,
  }))
  const { data: historyRows } = await supabase
    .from("conversation_messages")
    .select("role, content, metadata")
    .eq("conversation_id", thread.id)
    .order("created_at", { ascending: true })
    .limit(ASK_HISTORY_TURNS + 1)
  const history = (((historyRows ?? []) as Array<{ role: string; content: string; metadata?: Record<string, unknown> }>)
    .filter((m) => (m.role === "user" || m.role === "assistant") && (m.metadata as Record<string, unknown> | undefined)?.type !== "shared_comment")
    .slice(-ASK_HISTORY_TURNS)
    .map((m) => ({ role: m.role, text: m.content.slice(0, 1000) })))

  const fitted = fitMessage(question)
  try {
    await addMessage(supabase as never, {
      conversationId: thread.id,
      userId,
      role: "user",
      content: fitted.content,
      operation,
      intent,
      metadata: { type: "shared_ask", shared: true, ...(fitted.truncated ? { truncated: true } : {}) },
    })
  } catch {
    return { ok: false, error: "We couldn't post that question." }
  }

  const material = (audit.raw_input ?? "").trim().slice(0, ASK_MATERIAL_CHARS)
  const dealType = audit.deal_type ?? "generic"
  const turnStart = Date.now()
  let answer: string
  try {
    const { systemPrompt, userContent } = buildAskPrompt({
      question,
      dealType,
      material: material || "(no material recorded yet)",
      findings,
      history,
      standing: null,
    })
    const res = await callAIForSurface("authenticated", {
      systemPrompt,
      userContent: userContent.slice(0, ASK_MATERIAL_CHARS + ASK_PROMPT_CHARS),
      temperature: 0.2,
      maxTokens: 1200,
    })
    const parsed = parseClaimsBlock(res.text)
    const conflicts = detectFindingConflicts(stored.filter(valid), parsed.claims)
    answer = conflicts.length === 0
      ? parsed.clean || res.text.trim()
      : `I couldn't verify that against this deal's findings, so here is what they do say:\n${fails.slice(0, 5).map((f) => `• ${f.finding?.summary ?? f.ruleKey}`).join("\n") || "No risky patterns recorded."}`
    await addMessage(supabase as never, {
      conversationId: thread.id,
      userId,
      role: "assistant",
      content: answer,
      operation,
      intent,
      metadata: { type: "shared_ask_answer", shared: true },
    })
  } catch (err) {
    const msg = err instanceof AIProviderError
      ? "I couldn't reach the AI service. Your question is saved — ask again to retry."
      : "Ask failed. Your question is saved — try again."
    try {
      await addMessage(supabase as never, {
        conversationId: thread.id,
        userId,
        role: "assistant",
        content: msg,
        operation,
        intent,
        metadata: { type: "ask_failed", shared: true },
      })
    } catch {
      // Failure notice is best-effort; the question row stands.
    }
    return { ok: true, answer: msg }
  }
  try {
    const { logEvent } = await import("@/lib/logger")
    await logEvent({
      audit_id: thread.attached_audit_id,
      user_id: userId,
      phase: "ask_turn",
      status: "success",
      duration_ms: Date.now() - turnStart,
      metadata: { shared: true },
    }).catch(() => undefined)
  } catch {
    // Telemetry never fails the answer.
  }
  return { ok: true, answer }
}

/**
 * Owner-delete for shared comments: the thread owner may remove reader
 * rows on owned deals. Own rows were never deletable and stay that way;
 * reader rows on other owners' deals are untouchable.
 */
export async function deleteSharedMessage(input: { messageId: string }): Promise<
  ActionOk<{ deleted: boolean }> | ActionFail
> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed
  if (!UUID_RE.test(input.messageId)) return { ok: false, error: "Invalid message." }
  const { data: msg } = await supabase
    .from("conversation_messages")
    .select("id, conversation_id, user_id")
    .eq("id", input.messageId)
    .maybeSingle()
  const row = msg as { id: string; conversation_id: string; user_id: string } | null
  if (!row) return { ok: false, error: "Message not found." }
  if (row.user_id === userId) return { ok: false, error: "Messages can't be deleted." }
  const { data: convo } = await supabase
    .from("conversations")
    .select("attached_audit_id")
    .eq("id", row.conversation_id)
    .maybeSingle()
  const auditId = (convo as { attached_audit_id?: string | null } | null)?.attached_audit_id
  if (!auditId) return { ok: false, error: "Message not found." }
  const audit = await ownedAudit(supabase, userId, auditId)
  if (!audit) return { ok: false, error: "Only the deal owner can remove comments." }
  const { error } = await supabase
    .from("conversation_messages")
    .delete()
    .eq("id", row.id)
    .neq("user_id", userId)
  if (error) return { ok: false, error: "We couldn't remove that comment." }
  return { ok: true, deleted: true }
}
