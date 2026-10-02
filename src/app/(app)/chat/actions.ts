"use server"

import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { classifyOperation, inferIntent, isGreeting } from "@/lib/conversation/classify"
import { addMessage, createConversation, getConversation, listMessages } from "@/lib/conversation/store"
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

const AUDIT_FILES_BUCKET = "audit-files"
const MAX_RAW_INPUT_CHARS = 500_000

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
    .select("id, title, deal_type, raw_input, updated_at")
    .eq("id", auditId)
    .eq("user_id", userId)
    .maybeSingle()
  return (data as { id: string; title: string | null; deal_type: string | null; raw_input: string | null; updated_at: string } | null) ?? null
}

/**
 * Slice-one creation: text (and optionally a confirmed deal type) mints an
 * audit plus its thread and first messages. The assistant message records
 * the classifier's visible shot — operation, intent, proposed type — with
 * one-tap correction in the thread. Nothing analyzes yet.
 */
export async function createDeal(input: { text: string; dealType?: string }): Promise<
  | ActionOk<{ threadId: string; auditId: string; operation: string; intent: string; dealType: IntakeDealType }>
  | ActionFail
> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const text = input.text.trim()
  if (!text) return { ok: false, error: "Describe the deal first." }
  if (isGreeting(text)) {
    return { ok: false, error: "GREETING:Say hello back instead — greetings never become deals." }
  }
  const dealType: IntakeDealType = isIntakeDealType(input.dealType) ? input.dealType : proposeDealType(text)
  const operation = classifyOperation(text, false)
  const intent = inferIntent(text, operation)
  const raw = text.length > MAX_RAW_INPUT_CHARS ? `${text.slice(0, MAX_RAW_INPUT_CHARS).trimEnd()}…(truncated)` : text

  const { data: audit, error: auditError } = await supabase
    .from("audits")
    .insert({ user_id: userId, title: deriveTitle(text), deal_type: dealType, raw_input: raw })
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
      content: `Looks like ${operation} · ${dealType}. Correct it below if I read it wrong — analysis starts once you confirm.`,
      operation,
      intent,
      metadata: { type: "routing_shot", operation, intent, dealType },
    })
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
  return { ok: true, saved: true }
}

export interface ThreadView {
  threadId: string
  title: string
  auditId: string | null
  dealType: string | null
  operation: string | null
  intent: string | null
  messages: Array<{ id: string; role: "user" | "assistant"; content: string; created_at: string; metadata: Record<string, unknown> }>
}

/** Load a thread for the workspace: audit, shot state, messages. */
export async function getThread(threadId: string): Promise<ActionOk<{ thread: ThreadView }> | ActionFail> {
  const authed = await authedUserId()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const thread = await getConversation(supabase as never, userId, threadId).catch(() => null)
  if (!thread) return { ok: false, error: "Thread not found." }
  const messages = await listMessages(supabase as never, userId, threadId, 50).catch(() => [])
  let audit: { id: string; title: string | null; deal_type: string | null } | null = null
  if (thread.attached_audit_id) {
    audit = await ownedAudit(supabase, userId, thread.attached_audit_id)
  }
  const shot = [...messages].reverse().find((m) => (m.metadata as Record<string, unknown>)?.type === "routing_shot")
  const shotMeta = (shot?.metadata ?? {}) as Record<string, unknown>
  return {
    ok: true,
    thread: {
      threadId: thread.id,
      title: thread.title,
      auditId: audit?.id ?? null,
      dealType: audit?.deal_type ?? (typeof shotMeta.dealType === "string" ? shotMeta.dealType : null),
      operation: typeof shotMeta.operation === "string" ? shotMeta.operation : null,
      intent: typeof shotMeta.intent === "string" ? shotMeta.intent : null,
      messages: messages.map((m) => ({
        id: m.id,
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
