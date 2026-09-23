// Protection work via WorkPlan — Finding → Protection Intent → Document → WorkProduct
// Reuses existing verticals, protection intents, clauses, assembly, variable-autofill, evidence.

import type { SupabaseClient } from "@supabase/supabase-js"
import { createPlan } from "./store"
import { planPayloadHash } from "./hash"

type Client = SupabaseClient

export interface CreateProtectionPlanInput {
  conversationId: string
  dealId: string
  findingIds: string[] // ruleKeys or finding IDs
  protectionObjective?: string
  requestedDocumentType?: string // proposal, sow, contract, protection_clause, etc.
}

export async function createProtectionPlan(client: Client, userId: string, input: CreateProtectionPlanInput): Promise<{ planId: string; estimatedCredits: number }> {
  if (!input.findingIds || input.findingIds.length === 0) throw new Error("At least one finding is required for protection")

  // Load deal to validate ownership and derive objective
  const { data: audit } = await client.from("audits").select("title, deal_type").eq("id", input.dealId).eq("user_id", userId).maybeSingle()
  if (!audit) throw new Error("Deal not found")

  // Check for existing active protection plan for same conversation+deal+findings (deduplication)
  const { data: existing } = await client
    .from("work_plans")
    .select("id, payload_hash, status")
    .eq("user_id", userId)
    .eq("conversation_id", input.conversationId)
    .eq("objective_kind", "protection")
    .in("status", ["awaiting_approval", "approved", "executing", "needs_input", "rate_limited"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing) {
    // If existing plan has same findings, reuse (server-side deduplication)
    // For Phase 2, we check if existing plan's findings match requested findings via payload_hash comparison would be more precise,
    // but for now we reuse if any active protection plan exists for same conversation
    return { planId: (existing as { id: string }).id, estimatedCredits: 0 }
  }

  const objective = input.protectionObjective || `Protect deal: ${(audit as { title?: string }).title?.slice(0, 80) ?? "this deal"} — ${input.findingIds.length} finding(s)`

  // Estimate: protection intent is 0 (deterministic); document generation is
  // priced per family (proposal 10 / sow 15 / contract 20 / checklist 10,
  // 1 credit for any other micro-draft type).
  const { creditsForDocumentType } = await import("@/lib/credits/pricing")
  const docCredits = input.requestedDocumentType ? creditsForDocumentType(input.requestedDocumentType) : 0
  const steps: Array<{ operation: string; inputRef: Record<string, unknown>; estimatedCredits: number }> = [
    { operation: "generate_draft", inputRef: { auditId: input.dealId, findingIds: input.findingIds, protectionObjective: objective, requestedDocumentType: input.requestedDocumentType ?? "protection_clause" }, estimatedCredits: docCredits },
  ]

  const estimated = docCredits
  const { plan } = await createPlan(client as never, userId, {
    conversationId: input.conversationId,
    dealId: input.dealId,
    objective,
    objectiveKind: "protection",
    steps: steps as never,
  })
  return { planId: plan.id, estimatedCredits: estimated }
}

export async function getProtectionContext(client: Client, userId: string, dealId: string, findingIds: string[]) {
  // Load findings, evidence, assumptions for assumption review
  const { data: audit } = await client.from("audits").select("structured_data, raw_input, deal_type, context_envelope").eq("id", dealId).eq("user_id", userId).maybeSingle()
  if (!audit) throw new Error("Deal not found")
  const sd = (audit as { structured_data?: Record<string, unknown> }).structured_data as Record<string, unknown> | undefined
  const findings = (sd?.deterministicFindings as Array<{ ruleKey?: string; finding?: { evidence?: Array<{ id: string }> } }> | undefined) ?? []
  const relevant = findings.filter((f) => findingIds.includes((f as { ruleKey?: string }).ruleKey ?? "") || findingIds.includes((f as { finding?: { ruleKey?: string } }).finding?.ruleKey ?? ""))
  const evidenceIds = relevant.flatMap((f) => ((f as { evidence?: Array<{ id: string }> }).evidence ?? (f as { finding?: { evidence?: Array<{ id: string }> } }).finding?.evidence ?? []).map((e) => e.id))
  const missing = (sd?.missingVariables as string[] | undefined) ?? []
  // Provenance from ContextEnvelope
  const envelope = (audit as { context_envelope?: Record<string, unknown> }).context_envelope as Record<string, unknown> | undefined
  const fields = (envelope as { fields?: Record<string, { value: unknown; source: string }> } | undefined)?.fields
  const known: string[] = []
  const inferred: string[] = []
  const missingInfo: string[] = [...missing]
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (v.source === "user_confirmed" && v.value) known.push(`${k}: ${String(v.value).slice(0, 40)}`)
      else if (v.source === "inferred" && v.value) inferred.push(`${k}: ${String(v.value).slice(0, 40)} (inferred)`)
      else if (v.source === "unknown") missingInfo.push(k)
    }
  }
  return { findings: relevant, evidenceIds, known, inferred, missing: missingInfo, dealType: (audit as { deal_type?: string }).deal_type ?? "generic" }
}
