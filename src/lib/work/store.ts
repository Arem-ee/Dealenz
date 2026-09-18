// Persistence helpers for work execution (Phase 23C).
//
// All helpers are thin wrappers over Supabase client with RLS (user_id = auth.uid()).
// No service_role, no bypass. Ownership validated on every read/write.

import type { SupabaseClient } from "@supabase/supabase-js"
import { payloadHash, planPayloadHash } from "./hash"
import type { CreatePlanInput, PlanRow, PlanStepRow, WorkApprovalRow, WorkExecutionRow, WorkProductRow } from "./schema"
import { sumEstimatedCredits, validateCreatePlan } from "./schema"

type Client = SupabaseClient

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

// Create a plan + its steps atomically (client-side transaction via sequential inserts; rollback on failure is best-effort).
export async function createPlan(client: Client, userId: string, input: Omit<CreatePlanInput, "userId">): Promise<{ plan: PlanRow; steps: PlanStepRow[] }> {
  const full: CreatePlanInput = { ...input, userId }
  const err = validateCreatePlan(full)
  if (err) throw new Error(err)
  const estimated = sumEstimatedCredits(input.steps)
  const ph = planPayloadHash({
    objective: input.objective,
    objectiveKind: input.objectiveKind ?? "deal_analysis",
    estimatedCredits: estimated,
    steps: input.steps.map((s) => ({
      operation: s.operation,
      inputRef: s.inputRef ?? {},
      dependsOn: s.dependsOn ?? [],
      estimatedCredits: s.estimatedCredits,
    })),
  })
  if (input.conversationId && !isUUID(input.conversationId)) throw new Error("Invalid conversationId")
  if (input.dealId && !isUUID(input.dealId)) throw new Error("Invalid dealId")

  const { data: plan, error: planErr } = await client
    .from("work_plans")
    .insert({
      user_id: userId,
      conversation_id: input.conversationId ?? null,
      deal_id: input.dealId ?? null,
      objective: input.objective.trim(),
      objective_kind: input.objectiveKind ?? "deal_analysis",
      version: 1,
      estimated_credits: estimated,
      status: "draft",
      payload_hash: ph,
    })
    .select("*")
    .single()
  if (planErr || !plan) throw new Error(planErr?.message ?? "Failed to create plan")
  const planRow = plan as PlanRow

  // Steps: assign step_index 0..n-1, empty dependsOn resolved after insert would be circular; for now dependsOn holds step_index refs? Better to store ids after insert.
  // Simplification: dependsOn is empty for MVP (sequential). Full DAG validated later when ids known.
  // For now we persist steps with pending status and empty depends_on; dependsOn with ids requires second pass if used.
  const toInsert = input.steps.map((s, idx) => ({
    plan_id: planRow.id,
    user_id: userId,
    step_index: idx,
    operation: s.operation,
    input_ref: s.inputRef ?? {},
    depends_on: s.dependsOn ?? [],
    estimated_credits: s.estimatedCredits,
    status: "pending",
  }))
  const { data: steps, error: stepsErr } = await client.from("work_plan_steps").insert(toInsert).select("*")
  if (stepsErr) {
    // best-effort cleanup
    await client.from("work_plans").delete().eq("id", planRow.id).eq("user_id", userId)
    throw new Error(stepsErr.message)
  }
  return { plan: planRow, steps: (steps as PlanStepRow[]).sort((a, b) => a.step_index - b.step_index) }
}

export async function getPlan(client: Client, userId: string, planId: string): Promise<PlanRow | null> {
  if (!isUUID(planId) || !isUUID(userId)) return null
  const { data, error } = await client.from("work_plans").select("*").eq("id", planId).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PlanRow | null) ?? null
}

export async function listPlans(client: Client, userId: string, opts?: { conversationId?: string; limit?: number }): Promise<PlanRow[]> {
  let q = client.from("work_plans").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(opts?.limit ?? 20)
  if (opts?.conversationId) q = q.eq("conversation_id", opts.conversationId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data as PlanRow[]) ?? []
}

export async function getPlanSteps(client: Client, userId: string, planId: string): Promise<PlanStepRow[]> {
  const { data, error } = await client.from("work_plan_steps").select("*").eq("plan_id", planId).eq("user_id", userId).order("step_index", { ascending: true })
  if (error) throw new Error(error.message)
  return (data as PlanStepRow[]) ?? []
}

export async function requestPlanApproval(client: Client, userId: string, planId: string): Promise<PlanRow> {
  const plan = await getPlan(client, userId, planId)
  if (!plan) throw new Error("Plan not found")
  if (plan.status !== "draft" && plan.status !== "failed") throw new Error(`Cannot request approval from ${plan.status}`)
  const { data, error } = await client.from("work_plans").update({ status: "awaiting_approval", updated_at: new Date().toISOString() }).eq("id", planId).eq("user_id", userId).select("*").single()
  if (error || !data) throw new Error(error?.message ?? "Failed to request approval")
  return data as PlanRow
}

export async function approvePlan(
  client: Client,
  userId: string,
  planId: string,
  input: { idempotencyKey: string; scope?: Record<string, unknown>; expiresAt?: string | null }
): Promise<{ plan: PlanRow; approval: WorkApprovalRow }> {
  if (!input.idempotencyKey || input.idempotencyKey.length > 120) throw new Error("Approval needs idempotency key")
  // Advisory lock to prevent duplicate approvals for same plan_version
  try {
    await (client as unknown as { rpc: (n: string, p: unknown) => Promise<unknown> }).rpc("acquire_plan_lock", { p_plan_id: planId } as never)
  } catch {}
  const plan = await getPlan(client, userId, planId)
  if (!plan) throw new Error("Plan not found")
  if (plan.status !== "awaiting_approval") throw new Error(`Cannot approve from ${plan.status}`)
  const hash = plan.payload_hash
  // Idempotency: if same user+key exists, return it
  const { data: existing } = await client.from("work_approvals").select("*").eq("user_id", userId).eq("idempotency_key", input.idempotencyKey).maybeSingle()
  if (existing) {
    const ex = existing as WorkApprovalRow
    if (ex.plan_id === planId && ex.plan_version === plan.version && ex.approved_payload_hash === hash) {
      const { data: p } = await client.from("work_plans").select("*").eq("id", planId).eq("user_id", userId).maybeSingle()
      return { plan: p as PlanRow, approval: ex }
    }
    throw new Error("Idempotency key already used for different plan version")
  }
  const { data: approval, error: apprErr } = await client
    .from("work_approvals")
    .insert({
      plan_id: planId,
      user_id: userId,
      plan_version: plan.version,
      scope: input.scope ?? {},
      approved_payload_hash: hash,
      actor_user_id: userId,
      expires_at: input.expiresAt ?? null,
      idempotency_key: input.idempotencyKey,
    })
    .select("*")
    .single()
  if (apprErr || !approval) throw new Error(apprErr?.message ?? "Failed to create approval")
  const { data: updatedPlan, error: updErr } = await client
    .from("work_plans")
    .update({ status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("user_id", userId)
    .eq("status", "awaiting_approval")
    .select("*")
    .single()
  if (updErr || !updatedPlan) throw new Error(updErr?.message ?? "Failed to approve plan")
  return { plan: updatedPlan as PlanRow, approval: approval as WorkApprovalRow }
}

export async function rejectPlan(client: Client, userId: string, planId: string): Promise<PlanRow> {
  const plan = await getPlan(client, userId, planId)
  if (!plan) throw new Error("Plan not found")
  if (plan.status !== "awaiting_approval") throw new Error(`Cannot reject from ${plan.status}`)
  const { data, error } = await client.from("work_plans").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", planId).eq("user_id", userId).select("*").single()
  if (error || !data) throw new Error(error?.message ?? "Failed to reject plan")
  return data as PlanRow
}

export async function findActivePlanForConversation(client: Client, userId: string, conversationId: string): Promise<PlanRow | null> {
  if (!isUUID(conversationId) || !isUUID(userId)) return null
  const { data, error } = await client
    .from("work_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .in("status", ["awaiting_approval", "approved", "executing", "needs_input"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PlanRow | null) ?? null
}

export async function resumePlan(client: Client, userId: string, planId: string): Promise<{ plan: PlanRow; execution: WorkExecutionRow }> {
  const plan = await getPlan(client, userId, planId)
  if (!plan) throw new Error("Plan not found")
  if (plan.status !== "needs_input" && plan.status !== "rate_limited") throw new Error(`Cannot resume from ${plan.status}`)
  // Verify approval still valid (payload_hash unchanged)
  const { data: approval } = await client.from("work_approvals").select("*").eq("plan_id", planId).eq("user_id", userId).order("approved_at", { ascending: false }).limit(1).maybeSingle()
  if (!approval || (approval as WorkApprovalRow).approved_payload_hash !== plan.payload_hash || (approval as WorkApprovalRow).plan_version !== plan.version) {
    throw new Error("Approved payload changed — new approval required")
  }
  const targetExecStatus = plan.status === "rate_limited" ? "rate_limited" : "needs_input"
  const { data: execution, error: execErr } = await client
    .from("work_executions")
    .select("*")
    .eq("plan_id", planId)
    .eq("user_id", userId)
    .eq("status", targetExecStatus)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (execErr || !execution) throw new Error("No resumable execution found")
  const execRow = execution as WorkExecutionRow
  // Transition plan: needs_input/rate_limited → executing
  const { data: updatedPlan, error: planErr } = await client.from("work_plans").update({ status: "executing", updated_at: new Date().toISOString() }).eq("id", planId).eq("user_id", userId).eq("status", plan.status).select("*").single()
  if (planErr || !updatedPlan) throw new Error(planErr?.message ?? "Failed to resume plan")
  // Transition execution: needs_input/rate_limited → running
  const { data: updatedExec, error: execUpdateErr } = await client
    .from("work_executions")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", execRow.id)
    .eq("user_id", userId)
    .eq("status", targetExecStatus)
    .select("*")
    .single()
  if (execUpdateErr || !updatedExec) throw new Error(execUpdateErr?.message ?? "Failed to resume execution")
  // Transition steps: needs_input/rate_limited → pending
  await client.from("work_plan_steps").update({ status: "pending", updated_at: new Date().toISOString() }).eq("plan_id", planId).eq("user_id", userId).in("status", ["needs_input", "rate_limited"])
  return { plan: updatedPlan as PlanRow, execution: updatedExec as WorkExecutionRow }
}

// Execution: create a run row, caller will reserve credits with plan.estimated_credits
export async function createExecution(client: Client, userId: string, planId: string, planVersion: number): Promise<WorkExecutionRow> {
  const { data, error } = await client
    .from("work_executions")
    .insert({ plan_id: planId, user_id: userId, plan_version: planVersion, status: "pending" })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to create execution")
  return data as WorkExecutionRow
}

export async function getExecution(client: Client, userId: string, executionId: string): Promise<WorkExecutionRow | null> {
  const { data, error } = await client.from("work_executions").select("*").eq("id", executionId).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as WorkExecutionRow | null) ?? null
}

// Work product
export async function createWorkProduct(
  client: Client,
  userId: string,
  input: { planId: string; executionId?: string | null; kind: string; artifactRefs?: Array<{ type: string; id: string }>; snapshot?: Record<string, unknown> }
): Promise<WorkProductRow> {
  const { data, error } = await client
    .from("work_products")
    .insert({
      user_id: userId,
      plan_id: input.planId,
      execution_id: input.executionId ?? null,
      kind: input.kind,
      artifact_refs: input.artifactRefs ?? [],
      snapshot: input.snapshot ?? {},
      status: "draft",
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to create work product")
  return data as WorkProductRow
}

export { payloadHash }
