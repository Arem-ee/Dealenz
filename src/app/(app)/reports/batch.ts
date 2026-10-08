"use server"

import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { ANALYSIS_CREDITS } from "@/lib/credits/pricing"
import { buildBatchManifest, type BatchManifest } from "@/lib/batch/manifest"
import { MAX_BATCH_DEALS, type PlanStatus } from "@/lib/work/schema"
import type { RuleResult } from "@/lib/rules/result"

export type { BatchManifest }

export interface BatchDealOption {
  auditId: string
  threadId: string
  title: string
  dealType: string | null
}

export interface BatchPlanSummary {
  planId: string
  threadId: string
  objective: string
  status: PlanStatus
  stepsTotal: number
  stepsSucceeded: number
  stepsFailed: number
  createdAt: string
}

export interface BatchItemOutcome {
  auditId: string
  threadId: string | null
  title: string
  stepStatus: string
  criticalFails: number
  materialFails: number
}

export interface BatchRollup {
  planId: string
  threadId: string
  objective: string
  status: PlanStatus
  estimateCredits: number
  items: BatchItemOutcome[]
}

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

/** Deals eligible for a batch: owned audits that have a workspace thread. */
export async function listBatchDeals(): Promise<ActionOk<{ deals: BatchDealOption[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: audits, error } = await supabase
    .from("audits")
    .select("id, title, deal_type")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100)
  if (error) return { ok: false, error: "We couldn't load your deals. Please try again." }
  const rows = (audits ?? []) as Array<{ id: string; title: string | null; deal_type: string | null }>
  if (rows.length === 0) return { ok: true, deals: [] }
  const { data: threads } = await supabase
    .from("conversations")
    .select("id, attached_audit_id")
    .eq("user_id", user.id)
    .in("attached_audit_id", rows.map((a) => a.id))
    .limit(200)
  const threadByAudit = new Map<string, string>()
  for (const t of ((threads ?? []) as Array<{ id: string; attached_audit_id: string | null }>)) {
    if (t.attached_audit_id && !threadByAudit.has(t.attached_audit_id)) threadByAudit.set(t.attached_audit_id, t.id)
  }
  return {
    ok: true,
    deals: rows
      .filter((a) => threadByAudit.has(a.id))
      .map((a) => ({
        auditId: a.id,
        threadId: threadByAudit.get(a.id)!,
        title: a.title?.trim() ? a.title : "Untitled",
        dealType: a.deal_type,
      })),
  }
}

/**
 * Manifest preview (D1–D2): type mix + exact estimate over owned deals.
 * Computed, never stored — the work plan is the durable record (D8).
 */
export async function previewBatchManifest(input: {
  auditIds: string[]
}): Promise<ActionOk<{ manifest: BatchManifest; deals: BatchDealOption[] }> | ActionFail> {
  const listed = await listBatchDeals()
  if (!listed.ok) return listed
  const wanted = new Set((input.auditIds ?? []).filter((id) => typeof id === "string"))
  const deals = listed.deals.filter((d) => wanted.has(d.auditId))
  if (deals.length === 0) return { ok: false, error: "Pick at least one deal with a workspace thread." }
  if (deals.length > MAX_BATCH_DEALS) {
    return { ok: false, error: `A batch holds at most ${MAX_BATCH_DEALS} deals — split the rest into a second batch.` }
  }
  return {
    ok: true,
    deals,
    manifest: buildBatchManifest(deals.map((d) => ({ auditId: d.auditId, title: d.title, dealType: d.dealType }))),
  }
}

/**
 * Starts a batch: manifest-validated items become one multi-step plan with
 * its approval requested (the estimate gate). Execution follows approval
 * through the standard plan actions — never inline here.
 */
export async function startBatch(input: {
  auditIds: string[]
}): Promise<ActionOk<{ batchThreadId: string; planId: string; estimateCredits: number }> | ActionFail> {
  const preview = await previewBatchManifest(input)
  if (!preview.ok) return preview
  const { createBatchAnalysisPlan } = await import("@/lib/work/actions")
  const res = await createBatchAnalysisPlan({
    items: preview.deals.map((d) => ({ auditId: d.auditId, threadId: d.threadId })),
  })
  if (!res.ok) return { ok: false, error: res.error }
  return {
    ok: true,
    batchThreadId: res.batchThreadId,
    planId: res.planId,
    estimateCredits: preview.manifest.estimateCredits,
  }
}

/** Recent batch plans: multi-step deal-analysis plans, newest first. */
export async function listBatchPlans(): Promise<ActionOk<{ plans: BatchPlanSummary[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { listPlans, getPlanSteps } = await import("@/lib/work/store")
  const plans = await listPlans(supabase as never, user.id, { limit: 30 }).catch(() => [])
  const summaries: BatchPlanSummary[] = []
  for (const p of plans as Array<{
    id: string; conversation_id: string | null; objective: string; status: PlanStatus; created_at: string
  }>) {
    if (!p.conversation_id) continue
    const steps = await getPlanSteps(supabase as never, user.id, p.id).catch(() => [])
    if (steps.length < 2) continue
    summaries.push({
      planId: p.id,
      threadId: p.conversation_id,
      objective: p.objective,
      status: p.status,
      stepsTotal: steps.length,
      stepsSucceeded: steps.filter((s) => s.status === "succeeded").length,
      stepsFailed: steps.filter((s) => s.status === "failed").length,
      createdAt: p.created_at,
    })
    if (summaries.length >= 10) break
  }
  return { ok: true, plans: summaries }
}

/**
 * Portfolio rollup (D3): per-file status plus critical/material finding
 * counts from each deal's persisted findings. Flagged files link to their
 * deal threads for human review — the rollup reports, it never judges.
 */
export async function getBatchRollup(input: {
  planId: string
}): Promise<ActionOk<{ rollup: BatchRollup }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { getPlan, getPlanSteps } = await import("@/lib/work/store")
  const plan = await getPlan(supabase as never, user.id, (input.planId ?? "").trim()).catch(() => null)
  if (!plan) return { ok: false, error: "Batch not found." }
  const steps = await getPlanSteps(supabase as never, user.id, plan.id).catch(() => [])
  if (steps.length < 2) return { ok: false, error: "That plan isn't a batch." }
  const auditIds = [...new Set(
    steps.map((s) => (s.input_ref as { auditId?: unknown } | null)?.auditId).filter((id): id is string => typeof id === "string")
  )]
  const { data: audits } = await supabase
    .from("audits")
    .select("id, title, structured_data")
    .eq("user_id", user.id)
    .in("id", auditIds.length > 0 ? auditIds : ["00000000-0000-0000-0000-000000000000"])
  const byAudit = new Map<string, { title: string; findings: RuleResult[] }>()
  for (const a of ((audits ?? []) as Array<{ id: string; title: string | null; structured_data: { deterministicFindings?: unknown } | null }>)) {
    byAudit.set(a.id, {
      title: a.title?.trim() ? a.title : "Untitled",
      findings: (Array.isArray(a.structured_data?.deterministicFindings) ? a.structured_data.deterministicFindings : []) as RuleResult[],
    })
  }
  const { data: threads } = await supabase
    .from("conversations")
    .select("id, attached_audit_id")
    .eq("user_id", user.id)
    .in("attached_audit_id", auditIds.length > 0 ? auditIds : ["00000000-0000-0000-0000-000000000000"])
  const threadByAudit = new Map<string, string>()
  for (const t of ((threads ?? []) as Array<{ id: string; attached_audit_id: string | null }>)) {
    if (t.attached_audit_id && !threadByAudit.has(t.attached_audit_id)) threadByAudit.set(t.attached_audit_id, t.id)
  }
  const items: BatchItemOutcome[] = steps.map((s) => {
    const ref = (s.input_ref ?? {}) as { auditId?: unknown; threadId?: unknown }
    const auditId = typeof ref.auditId === "string" ? ref.auditId : ""
    const info = byAudit.get(auditId)
    const fails = (info?.findings ?? []).filter((r) => r.status === "FAIL" && r.finding)
    return {
      auditId,
      threadId: threadByAudit.get(auditId) ?? (typeof ref.threadId === "string" ? ref.threadId : null),
      title: info?.title ?? "Untitled",
      stepStatus: s.status,
      criticalFails: fails.filter((r) => r.finding!.severity === "critical").length,
      materialFails: fails.filter((r) => r.finding!.severity === "material").length,
    }
  })
  return {
    ok: true,
    rollup: {
      planId: plan.id,
      threadId: plan.conversation_id ?? "",
      objective: plan.objective,
      status: plan.status,
      estimateCredits: items.length * ANALYSIS_CREDITS,
      items,
    },
  }
}

/** Latest approval row id for a plan (execute needs the seal). */
export async function getBatchApprovalId(input: {
  planId: string
}): Promise<ActionOk<{ approvalId: string | null }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data } = await supabase
    .from("work_approvals")
    .select("id")
    .eq("plan_id", (input.planId ?? "").trim())
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = data as { id: string } | null
  return { ok: true, approvalId: row?.id ?? null }
}

/** Rejects a batch plan back to draft. */
export async function rejectBatchPlan(input: {
  planId: string
}): Promise<ActionOk<{ planId: string }> | ActionFail> {
  const { rejectWorkPlan } = await import("@/lib/work/actions")
  const res = await rejectWorkPlan((input.planId ?? "").trim())
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, planId: res.planId }
}

/** Approves a batch plan (estimate gate). Execution stays a separate call. */
export async function approveBatchPlan(input: {
  planId: string
}): Promise<ActionOk<{ planId: string }> | ActionFail> {
  const { approveWorkPlan } = await import("@/lib/work/actions")
  const res = await approveWorkPlan((input.planId ?? "").trim(), randomUUID())
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, planId: res.planId }
}

/** Executes an approved batch plan. Credits reserve per step; failures isolate per file. */
export async function executeBatchPlan(input: {
  planId: string
  approvalId: string
}): Promise<ActionOk<{ executionId: string; status: string }> | ActionFail> {
  const { executeApprovedPlan } = await import("@/lib/work/actions")
  const res = await executeApprovedPlan((input.planId ?? "").trim(), (input.approvalId ?? "").trim())
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, executionId: res.executionId, status: res.status }
}
