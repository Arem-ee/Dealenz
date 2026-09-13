// Context Resolution server actions (Phase 5B).
//
// Reads and writes live on the audits row, so context inherits the audits RLS
// ownership model with no new policy surface. Nothing from the browser is
// trusted: ownership is re-checked per call, and every envelope crossing the
// boundary is validated through parseContextEnvelope / applyUserConfirmation.

"use server"

import { createClient } from "@/lib/supabase/server"
import { normalizeDealType } from "@/lib/deal-type"
import {
  applyUserConfirmation,
  emptyContextEnvelope,
  evaluateContextGate,
  inferContextFields,
  mergeInferredContext,
  parseContextEnvelope,
  seedEnvelopeForDealType,
  type ConfirmationUpdate,
  type ContextEnvelope,
  type ContextFieldKey,
  type ContextGateResult,
  type ContextGateState,
  type DealType,
} from "@/lib/context"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in")
  return { supabase, user }
}

async function requireVerifiedUser() {
  const { supabase, user } = await requireUser()
  if (!user.email_confirmed_at) {
    throw new Error("Please verify your email address before using this feature.")
  }
  return { supabase, user }
}

async function loadOwnedAudit(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, auditId: string) {
  if (!UUID_RE.test(auditId)) throw new Error("Invalid audit ID")
  const { data: audit, error } = await supabase
    .from("audits")
    .select("id, user_id, deal_type, raw_input, context_envelope, context_version")
    .eq("id", auditId)
    .eq("user_id", userId)
    .single()
  if (error || !audit) throw new Error("Audit not found")
  return audit as {
    id: string
    user_id: string
    deal_type: unknown
    raw_input: unknown
    context_envelope: unknown
    context_version: unknown
  }
}

function readEnvelope(row: { context_envelope: unknown }): ContextEnvelope | null {
  if (row.context_envelope === null || row.context_envelope === undefined) return null
  // Malformed stored envelopes never propagate: they fail closed and are reseeded by ensure.
  return parseContextEnvelope(row.context_envelope)
}

async function persistEnvelope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  auditId: string,
  envelope: ContextEnvelope,
  eventType: string,
  eventPayload: Record<string, unknown>
) {
  const validated = parseContextEnvelope(envelope)
  const { error } = await supabase
    .from("audits")
    .update({
      context_envelope: JSON.parse(JSON.stringify(validated)) as never,
      context_version: validated.version,
      context_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", auditId)
    .eq("user_id", userId)
  if (error) throw new Error("Failed to save context")
  await supabase.from("activity_events").insert({
    user_id: userId,
    audit_id: auditId,
    event_type: eventType,
    payload: eventPayload,
    created_at: new Date().toISOString(),
  })
  return validated
}

export async function getContext(
  auditId: string
): Promise<{ success: boolean; envelope?: ContextEnvelope; gate?: ContextGateResult; error?: string }> {
  try {
    const { supabase, user } = await requireUser()
    const audit = await loadOwnedAudit(supabase, user.id, auditId)
    const envelope = readEnvelope(audit)
    const dealType = normalizeDealType(audit.deal_type)
    return { success: true, envelope: envelope ?? undefined, gate: evaluateContextGate(envelope, dealType) }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load context" }
  }
}

// Ensures a validated envelope exists for the audit row, seeding from the
// stored deal_type column when absent (legacy rows predate the envelope).
// Exported for analyzeDeal so the gate always evaluates against real state.
export async function ensureContextEnvelope(
  auditId: string
): Promise<{ success: boolean; envelope?: ContextEnvelope; error?: string }> {
  try {
    const { supabase, user } = await requireUser()
    const audit = await loadOwnedAudit(supabase, user.id, auditId)
    const existing = readEnvelope(audit)
    if (existing) return { success: true, envelope: existing }
    const seeded = seedEnvelopeForDealType(normalizeDealType(audit.deal_type))
    seeded.updatedAt = new Date().toISOString()
    seeded.updatedBy = user.id
    const saved = await persistEnvelope(supabase, user.id, auditId, seeded, "context_seeded", {
      source: "deal_type_column",
    })
    return { success: true, envelope: saved }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to resolve context" }
  }
}

export async function inferAndPersistContext(
  auditId: string
): Promise<{ success: boolean; envelope?: ContextEnvelope; gate?: ContextGateResult; error?: string }> {
  try {
    const { supabase, user } = await requireVerifiedUser()
    const audit = await loadOwnedAudit(supabase, user.id, auditId)
    const dealType = normalizeDealType(audit.deal_type)
    const rawInput = typeof audit.raw_input === "string" ? audit.raw_input : ""
    if (!rawInput.trim()) {
      return { success: false, error: "Add deal input first — paste text, upload a file, or use the guided form — then detect context." }
    }
    const base = readEnvelope(audit) ?? emptyContextEnvelope()
    const inferred = await inferContextFields({ dealType, rawInput }, "authenticated")
    const merged = mergeInferredContext(base, inferred)
    merged.version = (typeof audit.context_version === "number" ? audit.context_version : base.version) + 1
    merged.updatedAt = new Date().toISOString()
    merged.updatedBy = "system:inference"
    const saved = await persistEnvelope(supabase, user.id, auditId, merged, "context_inferred", {
      version: merged.version,
    })
    return { success: true, envelope: saved, gate: evaluateContextGate(saved, dealType) }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Context inference failed" }
  }
}

export async function confirmContext(  auditId: string,
  updates: ConfirmationUpdate
): Promise<{ success: boolean; envelope?: ContextEnvelope; gate?: ContextGateResult; error?: string }> {
  try {
    const { supabase, user } = await requireVerifiedUser()
    const audit = await loadOwnedAudit(supabase, user.id, auditId)
    const dealType = normalizeDealType(audit.deal_type)
    const base = readEnvelope(audit) ?? emptyContextEnvelope()
    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
      return { success: false, error: "No context updates provided" }
    }
    if (Object.keys(updates).length > 15) {
      return { success: false, error: "Too many context updates in one request" }
    }
    const confirmed = applyUserConfirmation(base, updates)
    confirmed.updatedAt = new Date().toISOString()
    confirmed.updatedBy = user.id
    const saved = await persistEnvelope(supabase, user.id, auditId, confirmed, "context_confirmed", {
      fields: Object.keys(updates),
      version: confirmed.version,
    })
    return { success: true, envelope: saved, gate: evaluateContextGate(saved, dealType) }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to confirm context" }
  }
}

export interface AnalysisGateCheck {
  ready: boolean
  state: ContextGateState
  message: string
  missing: ContextFieldKey[]
  envelope?: ContextEnvelope
}

// Shared-client variant for analyzeDeal: seeds a missing envelope from the
// stored deal_type column, persists it when the context columns exist, and
// evaluates the completeness gate. Never throws — failures resolve to a
// blocking message rather than crashing analysis.
export async function ensureContextForAnalysis(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  auditId: string,
  auditRow: Record<string, unknown>
): Promise<AnalysisGateCheck> {
  const blocked = (state: ContextGateState, message: string, missing: ContextFieldKey[] = [], envelope?: ContextEnvelope): AnalysisGateCheck => ({
    ready: false,
    state,
    message,
    missing,
    envelope,
  })
  try {
    const dealType = normalizeDealType(auditRow.deal_type)
    let envelope: ContextEnvelope | null = null
    const stored = auditRow.context_envelope
    if (stored !== null && stored !== undefined) {
      try {
        envelope = parseContextEnvelope(stored)
      } catch {
        envelope = null
      }
    }
    if (!envelope) {
      const seeded = seedEnvelopeForDealType(dealType)
      seeded.updatedAt = new Date().toISOString()
      seeded.updatedBy = userId
      try {
        const { error } = await supabase
          .from("audits")
          .update({
            context_envelope: JSON.parse(JSON.stringify(seeded)) as never,
            context_version: seeded.version,
            context_updated_at: new Date().toISOString(),
          })
          .eq("id", auditId)
          .eq("user_id", userId)
        if (error) throw error
      } catch {
        // Context columns unavailable (migration not applied): evaluate the
        // seed in memory so analysis is never blocked by missing schema.
      }
      envelope = seeded
    }
    const gate = evaluateContextGate(envelope, dealType)
    if (gate.state === "READY") {
      return { ready: true, state: gate.state, message: gate.detail, missing: [], envelope }
    }
    if (gate.state === "MISSING_REQUIRED_CONTEXT") {
      return blocked(
        gate.state,
        `Before analyzing, confirm the required deal context (missing: ${gate.missingRequired.join(", ")}). Use the Deal context panel to review and confirm.`,
        gate.missingRequired,
        envelope
      )
    }
    return blocked(
      gate.state,
      `Please confirm the detected deal context (${gate.unconfirmedRequired.join(", ")}) before analyzing. Use the Deal context panel to review and confirm.`,
      [],
      envelope
    )
  } catch {
    return blocked("MISSING_REQUIRED_CONTEXT", "Deal context could not be resolved. Please review the Deal context panel and try again.")
  }
}
