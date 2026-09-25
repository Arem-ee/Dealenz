"use server"

import { createClient } from "@/lib/supabase/server"
import { listMessages, addMessage, createConversation } from "@/lib/conversation/store"
import { isGreeting } from "@/lib/conversation/classify"
import { toActionFailure } from "@/lib/action-result"
import { toThreadMessage, type ThreadMessage } from "./types"
import { createHomeDeal } from "@/lib/deals/home"
import { autoFillDocumentVariables, getRequiredVariablesForFamily } from "@/lib/documents/variable-autofill"
import { familyById } from "@/lib/documents/families"
import { parseContextEnvelope } from "@/lib/context/schema"
import type { ExtractedData } from "@/lib/ai/extract"
import type { ContextEnvelope } from "@/lib/context/schema"

export type ThreadMessagesResult = { ok: true; messages: ThreadMessage[] } | { ok: false; error: string }
export type PostMessageResult = { ok: true; message: ThreadMessage } | { ok: false; error: string }
export type DealThreadResult = { ok: true; threadId: string; auditId: string } | { ok: false; error: string }
export type RiskAnalysisResult = { ok: true; status: "done" | "failed" | "needs_confirm" } | { ok: false; error: string }
export type DocumentDraftResult = { ok: true } | { ok: false; error: string }

// Email-verification policy (P0-3): analyzeAndPostRisk and
// generateDocumentAndPost trigger AI calls and credit consumption (via
// analyzeDeal / generateProtectionPackage / generateBusinessOwnerDraft), so
// they require a verified email like those downstream actions. Thread
// creation, message reads/writes, and thread listing stay available
// pre-verification: they create drafts and read the caller's own rows, and
// the AI gates still fail closed downstream.
const VERIFY_REQUIRED_ERROR = "Please verify your email address before using this feature."

export async function getThreadMessages(threadId: string): Promise<ThreadMessagesResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: true, messages: [] }
    const rows = await listMessages(supabase as never, user.id, threadId, 50)
    return { ok: true, messages: rows.map((r) => toThreadMessage(r as never)) }
  } catch (err) {
    return toActionFailure(err, "We couldn't load these messages. Please refresh and try again.")
  }
}

export async function postRichMessage(threadId: string, input: { type: string; payload: Record<string, unknown>; content: string; role?: "user" | "assistant" }): Promise<PostMessageResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    const row = await addMessage(supabase as never, {
      conversationId: threadId,
      userId: user.id,
      role: input.role ?? "assistant",
      content: input.content,
      metadata: { type: input.type, payload: input.payload },
    })
    return { ok: true, message: toThreadMessage(row as never) }
  } catch (err) {
    return toActionFailure(err, "We couldn't post that message. Please try again.")
  }
}

export async function createDealThread(text: string): Promise<DealThreadResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    const { id: auditId } = await createHomeDeal(text, undefined)
    const conv = await createConversation(supabase as never, user.id, { firstText: text, attachedAuditId: auditId })
    await addMessage(supabase as never, { conversationId: conv.id, userId: user.id, role: "user", content: text })
    return { ok: true, threadId: conv.id, auditId }
  } catch (err) {
    return toActionFailure(err, "We couldn't start your deal. Please try again.")
  }
}

export async function analyzeAndPostRisk(threadId: string, auditId: string): Promise<RiskAnalysisResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    const inner = await analyzeAndPostRiskInner(threadId, auditId)
    return { ok: true, status: inner.status }
  } catch (err) {
    return toActionFailure(err, "Risk analysis failed. Please try again — nothing was charged for this attempt.")
  }
}

async function analyzeAndPostRiskInner(threadId: string, auditId: string): Promise<{ status: "done" | "failed" | "needs_confirm" }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in.")
  const { analyzeDeal } = await import("@/app/audit/[id]/actions")
  const { parseContextEnvelope } = await import("@/lib/context/schema")
  const { data: audit } = await supabase.from("audits").select("context_envelope, deal_type, raw_input, structured_data").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  let envelope: ReturnType<typeof parseContextEnvelope> | null = null
  try {
    envelope = audit?.context_envelope ? parseContextEnvelope(audit.context_envelope) : null
  } catch { envelope = null }
  const gate = envelope ? (await import("@/lib/context/gate")).evaluateContextGate(envelope, (audit as { deal_type?: string })?.deal_type as never) : null
  if (gate && gate.state !== "READY") {
    const { buildConfirmFields } = await import("@/lib/context/confirm-fields")
    const fields = buildConfirmFields(audit?.context_envelope, String((audit as { deal_type?: string })?.deal_type ?? "generic")) ?? []
    const posted = await postRichMessage(threadId, { type: "context_confirm", payload: { fields }, content: "Quick check — is this right?" })
    if (!posted.ok) throw new Error(posted.error)
    return { status: "needs_confirm" as const }
  }
  // Billing lives inside analyzeDeal (reserve → finalize/void): a single
  // charge per analysis no matter which path calls it. No outer reservation
  // here — that would double-charge. Insufficient-credit and failure
  // messaging surfaces through analyzeDeal's own error text below.
  const result = await analyzeDeal(auditId)
  if (!result.success || !result.riskReport) {
    const posted = await postRichMessage(threadId, { type: "text", payload: {}, content: result.error ?? "Analysis failed." })
    if (!posted.ok) throw new Error(posted.error)
    return { status: "failed" as const }
  }
  const findings = (result.deterministicFindings ?? []) as Array<{ ruleKey?: string; finding?: { severity: string; summary: string; guidance?: string; evidence?: unknown }; severity?: string; summary?: string; guidance?: string; evidence?: unknown }>
  const payload = {
    riskLevel: (result.riskReport as { riskLevel?: string })?.riskLevel ?? "Unknown",
    overallScore: (result.riskReport as { overallScore?: number })?.overallScore,
    riskDegraded: result.riskDegraded ?? false,
    rulesDegraded: result.rulesDegraded ?? false,
    findings: findings.map((f) => {
      const src = (f.finding ?? f) as { severity: string; summary: string; guidance?: string; pushback?: string; evidence?: unknown }
      // Evidence travels from the deterministic findings (attached by
      // attachEvidence at analysis time). Absent stays absent, never faked.
      return { ruleKey: f.ruleKey ?? null, severity: src.severity, summary: src.summary, whyItMatters: src.guidance, pushback: src.pushback, evidence: Array.isArray(src.evidence) ? src.evidence : [] }
    }),
  }
  // Re-checks announce their verdict (resolved / still open / new) instead of
  // the first-analysis message. findingDelta is server-computed and typed;
  // absent on first analysis.
  const { analysisThreadMessage } = await import("@/lib/rules/result")
  const content = analysisThreadMessage({ findingDelta: result.findingDelta ?? null })
  const riskPosted = await postRichMessage(threadId, { type: "risk_report", payload, content })
  if (!riskPosted.ok) throw new Error(riskPosted.error)

  // Lawyer-review trigger — dual condition, once per deal
  try {
    const structured = (audit as { structured_data?: Record<string, unknown> } | null)?.structured_data ?? {}
    if (!(structured as Record<string, unknown>).lawyerReviewSuggested) {
      const rawText = String((audit as { raw_input?: string | null })?.raw_input ?? "")
      const dealType = String((audit as { deal_type?: string })?.deal_type ?? "generic")
      const { verticalForDealType } = await import("@/lib/verticals")
      const vertical = verticalForDealType(dealType)
      const facts: Record<string, { text: string | null } | null> = {}
      if (vertical) {
        try {
          const extracted = (result as { data?: { goals?: string[]; deliverables?: string[]; budget?: string | null } })?.data as unknown as import("@/lib/ai/extract").ExtractedData | null
          const derived = vertical.deriveFacts((extracted ?? { goals: [], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0 }) as import("@/lib/ai/extract").ExtractedData, rawText, { type: "audit_input", id: auditId })
          for (const [k, v] of Object.entries(derived as Record<string, { text?: string | null } | null>)) {
            const t = (v as { text?: string | null })?.text ?? null
            facts[k] = { text: t }
          }
        } catch {}
      }
      // Fallback: also check raw liability patterns if facts not derived
      const { shouldRecommendLawyerReview, shouldRecommendLawyerReviewFallback } = await import("@/lib/lawyer/trigger")
      const extractedForTrigger = (result as { data?: import("@/lib/ai/extract").ExtractedData })?.data ?? null
      const check = shouldRecommendLawyerReview({ dealType, extracted: extractedForTrigger, facts, rawText, envelope, alreadySuggested: false })
      let should = check.should
      if (!should) {
        const fallback = shouldRecommendLawyerReviewFallback({ dealType, extracted: extractedForTrigger, facts, rawText, envelope, alreadySuggested: false })
        if (fallback) should = true
      }
      if (should) {
        const posted = await postRichMessage(threadId, {
          type: "lawyer_recommendation",
          payload: { auditId, threadId, reason: "This deal has meaningful stakes and an exposure pattern where independent review would help. Dealenz isn't a law firm — consider having a lawyer of your own review the final document." },
          content: "Consider an independent legal review for this deal.",
        })
        if (!posted.ok) throw new Error(posted.error)
        await supabase
          .from("audits")
          .update({ structured_data: { ...structured, lawyerReviewSuggested: true, lawyerReviewSuggestedAt: new Date().toISOString() }, updated_at: new Date().toISOString() })
          .eq("id", auditId)
          .eq("user_id", user.id)
      }
    }
  } catch {}

  return { status: "done" as const }
}

export async function generateDocumentAndPost(threadId: string, auditId: string, vars: Record<string, string> = {}): Promise<DocumentDraftResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    return await generateDocumentAndPostInner(threadId, auditId, vars)
  } catch (err) {
    return toActionFailure(err, "We couldn't generate that document. Please try again — nothing was charged for this attempt.")
  }
}

async function generateDocumentAndPostInner(threadId: string, auditId: string, vars: Record<string, string> = {}): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in.")
  const { data: audit } = await supabase.from("audits").select("deal_type, context_envelope, structured_data").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  if (!audit) throw new Error("Deal not found.")
  const dealType = (audit as { deal_type?: string })?.deal_type ?? "generic"
  
  // Parse context envelope
  let envelope: ContextEnvelope | null = null
  try {
    envelope = audit.context_envelope ? parseContextEnvelope(audit.context_envelope) : null
  } catch {}

  // Load extracted data from structured_data
  const structured = audit.structured_data as Record<string, unknown> | null
  const extractedData = structured?.extractedData as ExtractedData | undefined

  let payload: Record<string, unknown> = {}
  let content = "Document draft ready."
  try {
    if (dealType === "freelance") {
      const { generateProtectionPackage } = await import("@/app/audit/[id]/actions")
      const res = await generateProtectionPackage(auditId)
      if (res.success && res.documents?.[0]) {
        payload = { title: res.documents[0].title, preview: res.documents[0].content.slice(0, 600), auditId, threadId, status: "ready" }
        content = `Draft ready: ${res.documents[0].title}`
      } else {
        payload = { title: "Proposal", preview: res.error ?? "Generation failed", auditId, threadId, status: "error" }
        content = res.error ?? "Generation failed"
      }
    } else {
      const { familiesForDealType } = await import("@/lib/documents/families")
      const families = familiesForDealType(dealType)
      const familyId = families[0]?.id
      if (!familyId) {
        payload = { title: "Document", preview: "No draft families for this deal type.", auditId, threadId, status: "needs_input", missingVars: ["jurisdiction"] }
        content = "Tell me the jurisdiction to generate the draft."
      } else {
        const family = familyById(familyId)
        
        // Also get clause-level variables from the clause library
        const { clausesForDealType } = await import("@/lib/protection/clauses")
        const clauses = clausesForDealType(dealType)
        const familyClauses = family?.clauseIds.map(id => clauses.find(c => c.id === id)).filter(Boolean) ?? []
        const clauseVars = new Set<string>()
        for (const clause of familyClauses) {
          if (!clause) continue
          for (const v of clause.variables) {
            if (v.required) clauseVars.add(v.key)
          }
        }
        
        // Auto-fill variables from extracted data and context
        const { variables: autoFilledVars, provenance, missing: autoMissing } = autoFillDocumentVariables(
          extractedData ?? { goals: [], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0 },
          envelope ? parseContextEnvelope(JSON.parse(JSON.stringify(audit.context_envelope))) : null,
          dealType,
          familyId!,
          [...clauseVars, ...getRequiredVariablesForFamily(familyId!, dealType)]
        )
        
        // Merge user-provided vars with auto-filled (user vars take precedence)
        const mergedVars = { ...autoFilledVars, ...vars }
        const missingVars = autoMissing.filter(k => !vars[k])
        
        let jurisdiction: string | null = null
        try {
          const env = envelope ? envelope : (audit.context_envelope ? parseContextEnvelope(audit.context_envelope) : null)
          jurisdiction = (env?.fields.jurisdiction.value as string | null) ?? null
        } catch {}
        const effectiveJurisdiction = mergedVars.jurisdiction || jurisdiction
        if (!effectiveJurisdiction) {
          payload = { title: families[0].title, preview: "", auditId, threadId, status: "needs_input", missingVars: ["jurisdiction"], vars: mergedVars, autoFilled: Object.keys(autoFilledVars), provenance }
          content = "Need jurisdiction to generate."
          const posted = await postRichMessage(threadId, { type: "document_draft", payload, content })
          if (!posted.ok) throw new Error(posted.error)
          return { ok: true }
        }
        const { generateBusinessOwnerDraft } = await import("@/app/audit/[id]/actions")
        const res = await generateBusinessOwnerDraft(auditId, familyId!, effectiveJurisdiction, mergedVars)
        if (res.success && res.draft) {
          payload = { 
            title: res.draft.title, 
            preview: res.draft.markdown.slice(0, 600), 
            auditId, 
            threadId, 
            status: missingVars.length > 0 ? "needs_input" : "ready", 
            vars: mergedVars, 
            autoFilled: Object.keys(autoFilledVars), 
            provenance,
            missingVars 
          }
          content = `Draft ready: ${res.draft.title}`
        } else {
          payload = { title: families[0].title, preview: res.error ?? "Generation failed", auditId, threadId, status: "error" }
          content = res.error ?? "Generation failed"
        }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed"
    if (msg.includes("CONSENT_REQUIRED")) throw new Error("CONSENT_REQUIRED")
    payload = { title: "Document", preview: msg, auditId, threadId, status: "error" }
    content = msg
  }
  const posted = await postRichMessage(threadId, { type: "document_draft", payload, content })
  if (!posted.ok) throw new Error(posted.error)
  return { ok: true }
}

export async function listThreads(): Promise<Array<{ id: string; title: string; auditId: string | null; updatedAt: string; preview?: string; status?: string | null; riskLevel?: string | null; overallScore?: number | null; openIssues?: number | null; resolvedCount?: number | null; topCategories?: Array<{ label: string; count: number }> }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  // Threads are conversations; for chat-per-deal, each audit's conversation is the thread.
  // We list conversations and also audits that have no conversation yet (orphan deals) as threads.
  const { listConversations } = await import("@/lib/conversation/store")
  const convs = await listConversations(supabase as never, user.id)
  const { data: audits } = await supabase
    .from("audits")
    .select("id, title, status, risk_report, structured_data, updated_at, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50)
  type AuditRow = {
    id: string
    title: string
    status: string
    risk_report?: { riskLevel?: unknown; overallScore?: unknown } | null
    structured_data?: { deterministicFindings?: unknown; findingDelta?: { resolved?: unknown } | null } | null
    updated_at: string
  }
  const auditMap = new Map(((audits ?? []) as AuditRow[]).map((a) => [a.id, a]))
  // Portfolio fields, all projected from the same persisted rows: headline
  // score, open-issue counts, resolved movement, and top finding
  // categories. Capped and defensive — malformed rows yield absence.
  const VERTICAL_PREFIXES = ["freelance-", "founder-", "employment-", "lease-", "purchase_sale-", "partnership-", "generic-"]
  function humanizeCategory(ruleKey: string): string {
    let rest = ruleKey
    for (const prefix of VERTICAL_PREFIXES) {
      if (rest.startsWith(prefix)) {
        rest = rest.slice(prefix.length)
        break
      }
    }
    const label = rest.replace(/[-_]+/g, " ").trim().replace(/^\w/, (c) => c.toUpperCase())
    return label || ruleKey
  }
  function portfolioFields(audit: {
    risk_report?: { riskLevel?: unknown; overallScore?: unknown } | null
    structured_data?: { deterministicFindings?: unknown; findingDelta?: { resolved?: unknown } | null } | null
  } | null | undefined): {
    riskLevel: string | null
    overallScore: number | null
    openIssues: number | null
    resolvedCount: number | null
    topCategories: Array<{ label: string; count: number }>
  } {
    const empty = { riskLevel: null as string | null, overallScore: null as number | null, openIssues: null as number | null, resolvedCount: null as number | null, topCategories: [] as Array<{ label: string; count: number }> }
    if (!audit) return empty
    const riskLevel = typeof audit.risk_report?.riskLevel === "string" ? audit.risk_report.riskLevel : null
    const overallScore = typeof audit.risk_report?.overallScore === "number" ? audit.risk_report.overallScore : null
    const det = audit.structured_data?.deterministicFindings
    let openIssues: number | null = null
    let resolvedCount: number | null = null
    const topCategories: Array<{ label: string; count: number }> = []
    const resolved = audit.structured_data?.findingDelta?.resolved
    if (Array.isArray(resolved)) resolvedCount = resolved.length
    if (Array.isArray(det)) {
      const fails: string[] = []
      for (const r of det) {
        if (typeof r !== "object" || r === null) continue
        const rec = r as { status?: unknown; ruleKey?: unknown }
        if (rec.status !== "FAIL" || typeof rec.ruleKey !== "string" || !rec.ruleKey) continue
        fails.push(rec.ruleKey)
      }
      openIssues = fails.length
      const counts = new Map<string, number>()
      for (const key of fails) {
        const label = humanizeCategory(key)
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
      for (const [label, count] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
        topCategories.push({ label, count })
      }
    }
    return { riskLevel, overallScore, openIssues, resolvedCount, topCategories }
  }
  // Build thread list from conversations; include audit title if attached
  const threads = convs.map((c) => {
    const audit = c.attached_audit_id ? auditMap.get(c.attached_audit_id) : null
    return {
      id: c.id,
      title: c.title || audit?.title || "Untitled",
      auditId: c.attached_audit_id ?? null,
      updatedAt: c.updated_at,
      status: audit?.status ?? null,
      ...portfolioFields(audit),
    }
  })
  // Also include audits without a conversation as standalone threads (legacy).
  // Junk rows must never resurface as phantom "deals": greeting-titled rows
  // (e.g. a pre-classifier-fix "hello" audit) and the old "New Deal"
  // placeholder drafts are skipped. Greeting *conversations* still appear
  // above as question threads (no audit attached) — that is correct.
  const attachedIds = new Set(convs.map((c) => c.attached_audit_id).filter(Boolean))
  for (const a of (audits ?? []) as Array<{ id: string; title: string; status: string; risk_report?: { riskLevel?: string } | null; structured_data?: { deterministicFindings?: unknown } | null; updated_at: string }>) {
    if (attachedIds.has(a.id)) continue
    if (isGreeting(a.title)) continue
    if (a.status === "draft" && (a.title === "New Deal" || a.title.trim().length === 0)) continue
    threads.push({
      id: a.id,
      title: a.title,
      auditId: a.id,
      updatedAt: a.updated_at,
      status: a.status,
      ...portfolioFields(a),
    })
  }
  threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return threads.slice(0, 30)
}
