"use server"

import { createClient } from "@/lib/supabase/server"
import { listMessages, addMessage, createConversation } from "@/lib/conversation/store"
import { toThreadMessage, type ThreadMessage } from "./types"
import { createHomeDeal } from "@/app/dashboard/home-actions"

export async function getThreadMessages(threadId: string): Promise<ThreadMessage[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const rows = await listMessages(supabase as never, user.id, threadId, 50)
  return rows.map((r) => toThreadMessage(r as never))
}

export async function postRichMessage(threadId: string, input: { type: string; payload: Record<string, unknown>; content: string; role?: "user" | "assistant" }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const row = await addMessage(supabase as never, {
    conversationId: threadId,
    userId: user.id,
    role: input.role ?? "assistant",
    content: input.content,
    metadata: { type: input.type, payload: input.payload },
  })
  return toThreadMessage(row as never)
}

export async function createDealThread(text: string): Promise<{ threadId: string; auditId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const { id: auditId } = await createHomeDeal(text, undefined)
  const conv = await createConversation(supabase as never, user.id, { firstText: text, attachedAuditId: auditId })
  await addMessage(supabase as never, { conversationId: conv.id, userId: user.id, role: "user", content: text })
  return { threadId: conv.id, auditId }
}

export async function analyzeAndPostRisk(threadId: string, auditId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const { analyzeDeal } = await import("@/app/audit/[id]/actions")
  const { parseContextEnvelope } = await import("@/lib/context/schema")
  const { data: audit } = await supabase.from("audits").select("context_envelope, deal_type, raw_input, structured_data").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  let envelope: ReturnType<typeof parseContextEnvelope> | null = null
  try {
    envelope = audit?.context_envelope ? parseContextEnvelope(audit.context_envelope) : null
  } catch { envelope = null }
  const gate = envelope ? (await import("@/lib/context/gate")).evaluateContextGate(envelope, (audit as { deal_type?: string })?.deal_type as never) : null
  if (gate && gate.state !== "READY") {
    const fields = [...gate.missingRequired, ...gate.unconfirmedRequired].slice(0, 3).map((k) => ({ key: k, label: k.replace(/([A-Z])/g, " $1").replace(/_/g, " "), value: String((envelope?.fields as Record<string, { value?: unknown }>)[k]?.value ?? ""), confidence: (envelope?.fields as Record<string, { confidence?: number }>)[k]?.confidence ?? 0 }))
    await postRichMessage(threadId, { type: "context_confirm", payload: { fields }, content: "Quick check — is this right?" })
    return { status: "needs_confirm" as const }
  }
  const result = await analyzeDeal(auditId)
  if (!result.success || !result.riskReport) {
    await postRichMessage(threadId, { type: "text", payload: {}, content: result.error ?? "Analysis failed." })
    return { status: "failed" as const }
  }
  const findings = (result.deterministicFindings ?? []) as Array<{ finding?: { severity: string; summary: string; guidance?: string }; severity?: string; summary?: string; guidance?: string }>
  const payload = {
    riskLevel: (result.riskReport as { riskLevel?: string })?.riskLevel ?? "Unknown",
    overallScore: (result.riskReport as { overallScore?: number })?.overallScore,
    findings: findings.map((f) => {
      const src = (f.finding ?? f) as { severity: string; summary: string; guidance?: string }
      return { severity: src.severity, summary: src.summary, whyItMatters: src.guidance }
    }),
  }
  await postRichMessage(threadId, { type: "risk_report", payload, content: `Risk analysis complete: ${payload.riskLevel}` })

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
        await postRichMessage(threadId, {
          type: "lawyer_recommendation",
          payload: { auditId, threadId, reason: "This deal has meaningful stakes and an exposure pattern where a review would help. You can request a lawyer review when ready." },
          content: "Consider a lawyer review for this deal.",
        })
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

export async function generateDocumentAndPost(threadId: string, auditId: string, vars: Record<string, string> = {}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const { data: audit } = await supabase.from("audits").select("deal_type, context_envelope").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  if (!audit) throw new Error("Audit not found")
  const dealType = (audit as { deal_type?: string })?.deal_type ?? "generic"
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
        let jurisdiction: string | null = null
        try {
          const { parseContextEnvelope } = await import("@/lib/context/schema")
          const env = audit.context_envelope ? parseContextEnvelope(audit.context_envelope) : null
          jurisdiction = (env?.fields.jurisdiction.value as string | null) ?? null
        } catch {}
        const effectiveJurisdiction = vars.jurisdiction || jurisdiction
        if (!effectiveJurisdiction) {
          payload = { title: families[0].title, preview: "", auditId, threadId, status: "needs_input", missingVars: ["jurisdiction"], vars }
          content = "Need jurisdiction to generate."
          await postRichMessage(threadId, { type: "document_draft", payload, content })
          return
        }
        const { generateBusinessOwnerDraft } = await import("@/app/audit/[id]/actions")
        const res = await generateBusinessOwnerDraft(auditId, familyId, effectiveJurisdiction, vars)
        if (res.success && res.draft) {
          payload = { title: res.draft.title, preview: res.draft.markdown.slice(0, 600), auditId, threadId, status: "ready", vars }
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
  await postRichMessage(threadId, { type: "document_draft", payload, content })
}

export async function listThreads(): Promise<Array<{ id: string; title: string; auditId: string | null; updatedAt: string; preview?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  // Threads are conversations; for chat-per-deal, each audit's conversation is the thread.
  // We list conversations and also audits that have no conversation yet (orphan deals) as threads.
  const { listConversations } = await import("@/lib/conversation/store")
  const convs = await listConversations(supabase as never, user.id)
  const { data: audits } = await supabase
    .from("audits")
    .select("id, title, updated_at, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50)
  const auditMap = new Map(((audits ?? []) as Array<{ id: string; title: string; updated_at: string }>).map((a) => [a.id, a]))
  // Build thread list from conversations; include audit title if attached
  const threads = convs.map((c) => {
    const audit = c.attached_audit_id ? auditMap.get(c.attached_audit_id) : null
    return {
      id: c.id,
      title: c.title || audit?.title || "Untitled",
      auditId: c.attached_audit_id ?? null,
      updatedAt: c.updated_at,
    }
  })
  // Also include audits without a conversation as standalone threads (legacy)
  const attachedIds = new Set(convs.map((c) => c.attached_audit_id).filter(Boolean))
  for (const a of (audits ?? []) as Array<{ id: string; title: string; updated_at: string }>) {
    if (!attachedIds.has(a.id)) {
      threads.push({ id: a.id, title: a.title, auditId: a.id, updatedAt: a.updated_at })
    }
  }
  threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return threads.slice(0, 30)
}
