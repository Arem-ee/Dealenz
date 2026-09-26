"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { deriveAnalysisStages, type AnalysisStage } from "@/lib/analysis/stages"

export type AnalysisStagesResult =
  | { ok: true; stages: AnalysisStage[] }
  | { ok: false; error: string }

/**
 * Buyer-facing analysis progress for one audit. Reads the phase rows
 * analyzeDeal already emits (system_logs) through the service role — users
 * have INSERT-only access to that table — scoped to the caller's own rows
 * for an audit they own (ownership checked through RLS first).
 *
 * Run-scoped: re-analyses reuse the audit, so rows before the latest
 * extraction start belong to a previous run and are dropped. The stage
 * mapper's moved-on rule keeps the reading stage honest across the cut.
 * Anything unexpected yields all-pending (the panel renders its static
 * state, exactly today's behavior) — progress is best-effort, never load
 * bearing.
 */
export async function getAnalysisStages(auditId: string): Promise<AnalysisStagesResult> {
  try {
    if (!auditId) return { ok: false, error: "Missing audit id" }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    const { data: audit } = await supabase
      .from("audits")
      .select("id, deal_type")
      .eq("id", auditId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!audit) return { ok: false, error: "Deal not found." }
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceUrl || !serviceKey) return { ok: false, error: "Unavailable" }
    const service = createServiceClient(serviceUrl, serviceKey)
    const { data: rows, error } = await service
      .from("system_logs")
      .select("phase, status, created_at")
      .eq("user_id", user.id)
      .eq("audit_id", auditId)
      .order("created_at", { ascending: true })
      .limit(80)
    if (error) return { ok: false, error: "Unavailable" }
    const all = ((rows ?? []) as Array<{ phase: string; status: string; created_at?: string }>)
    let cutoff = 0
    for (let i = 0; i < all.length; i++) {
      if (all[i]?.phase === "extraction" && all[i]?.status === "start") cutoff = i
    }
    const dealType = (audit as { deal_type?: string }).deal_type
    const stages = deriveAnalysisStages(all.slice(cutoff), {
      expectsResponses: dealType === "freelance" ? false : undefined,
    })
    return { ok: true, stages }
  } catch {
    return { ok: false, error: "Unavailable" }
  }
}
