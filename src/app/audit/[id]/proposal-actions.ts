"use server"

import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { buildProposalPlan } from "@/lib/proposals/plan"
import { generateProposalWithRefinement } from "@/lib/proposals"
import { parseContextEnvelope } from "@/lib/context/schema"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(id: string) { return UUID_RE.test(id) }

export async function generateProposalForAudit(auditId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isValidUUID(user.id)) return { success: false as const, error: "Unauthorized" }
  if (!user.email_confirmed_at) return { success: false as const, error: "Please verify your email" }
  if (!auditId || !isValidUUID(auditId)) return { success: false as const, error: "Invalid audit ID" }

  const { data: audit } = await supabase.from("audits").select("*").eq("id", auditId).eq("user_id", user.id).single()
  if (!audit) return { success: false as const, error: "Audit not found" }

  const { data: consentRow } = await supabase.from("user_ai_consents").select("has_consented_to_ai_analysis").eq("user_id", user.id).maybeSingle()
  const hasConsented = (consentRow as { has_consented_to_ai_analysis?: boolean } | null)?.has_consented_to_ai_analysis === true
  if (!hasConsented) return { success: false as const, error: "CONSENT_REQUIRED" }

  const rate = await checkRateLimit("generateProtectionPackage")
  if (!rate.allowed) return { success: false as const, error: rate.error ?? "Rate limit" }

  let envelope: ReturnType<typeof parseContextEnvelope> | null = null
  try {
    envelope = audit.context_envelope ? parseContextEnvelope(audit.context_envelope) : null
  } catch { envelope = null }

  const extracted = (audit.structured_data as Record<string, unknown> | null)?.extractedData as unknown as import("@/lib/ai/extract").ExtractedData | null ?? null
  const rawInput = (audit as { raw_input?: string | null }).raw_input ?? null

  const result = await generateProposalWithRefinement({ envelope, extracted, rawInput })

  const content = result.proposal
  const timestamp = new Date().toISOString()

  const { data: existing } = await supabase.from("document_versions").select("version_number").eq("audit_id", auditId).eq("document_type", "proposal").order("version_number", { ascending: false }).limit(1).maybeSingle<{ version_number: number }>()
  const nextVersion = existing && typeof existing.version_number === "number" ? existing.version_number + 1 : 1
  await supabase.from("document_versions").insert({
    audit_id: auditId,
    user_id: user.id,
    document_type: "proposal",
    version_number: nextVersion,
    content,
    generation_method: result.refined ? "ai" : "ai",
    created_at: timestamp,
  })

  const structured = (audit.structured_data as Record<string, unknown> | null) ?? {}
  await supabase.from("audits").update({
    structured_data: { ...structured, proposalEvaluation: result.evaluation, proposalPlan: result.plan },
    updated_at: timestamp,
  }).eq("id", auditId).eq("user_id", user.id)

  return { success: true as const, proposal: content, plan: result.plan, evaluation: result.evaluation, refined: result.refined }
}
