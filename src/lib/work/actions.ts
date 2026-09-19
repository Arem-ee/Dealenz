"use server"

import { createClient } from "@/lib/supabase/server"
import { createPlan, requestPlanApproval, approvePlan, rejectPlan } from "./store"
import { executePlan } from "./executor"
import { toActionFailure } from "@/lib/action-result"

export type CreatePlanResult = { ok: true; planId: string } | { ok: false; error: string }
export type ApprovalResult = { ok: true; planId: string } | { ok: false; error: string }
export type ExecuteResult = { ok: true; executionId: string; status: string } | { ok: false; error: string }

// Email-verification policy (P0-3): work-plan mutations and execution are
// AI/cost-bearing (credits reserved, AI calls, possible external sends), so
// they require a verified email like analyzeDeal/generate/Ask. Pure reads
// below (getLatestPlanForThread, getWorkProductForPlan, getAnalysisUsage)
// stay available pre-verification: they touch only the caller's own rows.
const VERIFY_REQUIRED_ERROR = "Please verify your email address before using this feature."

export async function createWorkPlan(input: {
  conversationId?: string | null
  dealId?: string | null
  objective: string
  objectiveKind?: string
  steps: Array<{ operation: string; inputRef?: Record<string, unknown>; dependsOn?: string[]; estimatedCredits: number }>
}): Promise<CreatePlanResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    const { plan } = await createPlan(supabase as never, user.id, {
      conversationId: input.conversationId ?? null,
      dealId: input.dealId ?? null,
      objective: input.objective,
      objectiveKind: (input.objectiveKind as never) ?? "custom",
      steps: input.steps as never,
    })
    return { ok: true, planId: plan.id }
  } catch (e) {
    return toActionFailure(e, "Could not create plan.") as never
  }
}

export async function requestApproval(planId: string): Promise<ApprovalResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    await requestPlanApproval(supabase as never, user.id, planId)
    return { ok: true, planId }
  } catch (e) {
    return toActionFailure(e, "Could not request approval.") as never
  }
}

export async function approveWorkPlan(planId: string, idempotencyKey: string): Promise<ApprovalResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    await approvePlan(supabase as never, user.id, planId, { idempotencyKey })
    return { ok: true, planId }
  } catch (e) {
    return toActionFailure(e, "Could not approve plan.") as never
  }
}

export async function rejectWorkPlan(planId: string): Promise<ApprovalResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    await rejectPlan(supabase as never, user.id, planId)
    return { ok: true, planId }
  } catch (e) {
    return toActionFailure(e, "Could not reject plan.") as never
  }
}

export async function executeApprovedPlan(planId: string, approvalId: string): Promise<ExecuteResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    // Load approval to validate hash/version
    const { data: approval } = await supabase.from("work_approvals").select("*").eq("id", approvalId).eq("plan_id", planId).eq("user_id", user.id).maybeSingle()
    if (!approval) return { ok: false, error: "Approval not found." }
    const { data: planCheck } = await supabase.from("work_plans").select("estimated_credits").eq("id", planId).eq("user_id", user.id).maybeSingle()
    const estimated = (planCheck as { estimated_credits?: number } | null)?.estimated_credits ?? 0
    const { STANDARD_CREDIT_POLICY } = await import("@/lib/credits/pricing")
    const policy = estimated > 0 ? STANDARD_CREDIT_POLICY : null
    const res = await executePlan({ client: supabase as never, userId: user.id, planId, approval: approval as never, policy })
    return { ok: true, executionId: res.executionId, status: res.status }
  } catch (e) {
    return toActionFailure(e, "Execution failed.") as never
  }
}

export async function createBatchWorkPlan(input: { conversationId: string; dealId: string; csvText: string; protectionObjective?: string }): Promise<CreatePlanResult & { estimatedCredits?: number }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    if (!input.conversationId || !input.dealId) return { ok: false, error: "Conversation and deal are required." }
    if (!input.csvText || input.csvText.trim().length === 0) return { ok: false, error: "Spreadsheet is empty." }
    // Deal must belong to the caller; row parsing stays client-side, plan
    // creation (credits, identity) stays server-side.
    const { data: audit } = await supabase.from("audits").select("id").eq("id", input.dealId).eq("user_id", user.id).maybeSingle()
    if (!audit) return { ok: false, error: "Deal not found." }
    const { createBatchPlan } = await import("./batch")
    const created = await createBatchPlan(supabase as never, user.id, {
      conversationId: input.conversationId,
      dealId: input.dealId,
      csvText: input.csvText,
      protectionObjective: input.protectionObjective,
    })
    return { ok: true, planId: created.planId, estimatedCredits: created.estimatedCredits }
  } catch (e) {
    return toActionFailure(e, "Could not create batch plan.") as never
  }
}

export async function createDealAnalysisPlan(input: { conversationId: string; dealId: string }): Promise<CreatePlanResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    if (!input.conversationId || !input.dealId) return { ok: false, error: "Conversation and deal are required." }
    // Server-side deduplication: if an active plan already exists for this conversation, reuse it
    const { findActivePlanForConversation } = await import("./store")
    const existing = await findActivePlanForConversation(supabase as never, user.id, input.conversationId)
    if (existing) {
      // Reuse existing active plan (awaiting_approval, approved, executing, needs_input) — do not create duplicate
      return { ok: true, planId: existing.id }
    }
    // Derive objective from deal audit title (existing data, not duplicated input)
    const { data: audit } = await supabase.from("audits").select("title, deal_type").eq("id", input.dealId).eq("user_id", user.id).maybeSingle()
    if (!audit) return { ok: false, error: "Deal not found." }
    const title = String((audit as { title?: unknown }).title ?? "").trim() || "this deal"
    const objective = `Analyze deal: ${title.slice(0, 120)}`
    const { plan } = await createPlan(supabase as never, user.id, {
      conversationId: input.conversationId,
      dealId: input.dealId,
      objective,
      objectiveKind: "deal_analysis",
      // document_analysis is intentionally zero-credit + usage-limited (5/day via increment_usage, see src/app/audit/[id]/actions.ts:369).
      // Credits are not reserved for this operation; the plan remains approval-gated for auditability.
      steps: [{ operation: "document_analysis", inputRef: { auditId: input.dealId, threadId: input.conversationId }, estimatedCredits: 0 }],
    })
    return { ok: true, planId: plan.id }
  } catch (e) {
    return toActionFailure(e, "Could not create analysis plan.") as never
  }
}

export async function getLatestPlanForThread(threadId: string): Promise<{ ok: true; plan: import("./schema").PlanRow | null; steps: import("./schema").PlanStepRow[]; execution: import("./schema").WorkExecutionRow | null } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    const { data: plans, error } = await supabase.from("work_plans").select("*").eq("user_id", user.id).eq("conversation_id", threadId).order("created_at", { ascending: false }).limit(1)
    if (error) throw new Error(error.message)
    const plan = (plans as unknown as import("./schema").PlanRow[] | null)?.[0] ?? null
    if (!plan) return { ok: true, plan: null, steps: [], execution: null }
    const { data: steps } = await supabase.from("work_plan_steps").select("*").eq("plan_id", plan.id).eq("user_id", user.id).order("step_index", { ascending: true })
    const { data: exec } = await supabase.from("work_executions").select("*").eq("plan_id", plan.id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
    return { ok: true, plan: plan as import("./schema").PlanRow, steps: (steps as import("./schema").PlanStepRow[] | null) ?? [], execution: (exec as import("./schema").WorkExecutionRow | null) ?? null }
  } catch (e) {
    return toActionFailure(e, "Could not load plan.") as never
  }
}

export async function getWorkProductForPlan(planId: string): Promise<{ ok: true; product: import("./schema").WorkProductRow | null } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    const { data, error } = await supabase.from("work_products").select("*").eq("plan_id", planId).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
    if (error) throw new Error(error.message)
    return { ok: true, product: (data as import("./schema").WorkProductRow | null) ?? null }
  } catch (e) {
    return toActionFailure(e, "Could not load work product.") as never
  }
}

export async function getAnalysisUsage(): Promise<{ ok: true; count: number; limit: number } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    const { data, error } = await supabase.from("usage_tracking").select("count").eq("user_id", user.id).eq("action_type", "analyzeDeal").eq("date", new Date().toISOString().slice(0, 10)).maybeSingle()
    if (error) throw new Error(error.message)
    const count = (data as { count?: number } | null)?.count ?? 0
    return { ok: true, count, limit: 5 }
  } catch (e) {
    return toActionFailure(e, "Could not load usage.") as never
  }
}

export async function resumeWorkPlan(planId: string): Promise<{ ok: true; planId: string } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    const { resumePlan } = await import("./store")
    await resumePlan(supabase as never, user.id, planId)
    return { ok: true, planId }
  } catch (e) {
    return toActionFailure(e, "Could not resume plan.") as never
  }
}
