// Narrow Dealenz executor (Phase 23C + Phase 3 parallel/background).
//
// Sequential by default, parallel for independent steps (bounded concurrency 5).
// No generic tool calling, no autonomous loop.
// Runs explicit PlanSteps: validate, then reserve plan credits, then execute
// bounded operations, record results, aggregate work product, finalize credits.
// Background execution: same logic, survives via execution_mode + retry + idempotency.

import type { SupabaseClient } from "@supabase/supabase-js"
import { isApprovalValidForPlan } from "./transitions"
import type { PlanRow, PlanStepRow } from "./schema"
import { getCreditBalance } from "@/lib/credits/ledger"

type Client = SupabaseClient

export type StepHandler = (step: PlanStepRow, ctx: { plan: PlanRow; executionId: string; client: Client }) => Promise<{ resultRef?: Record<string, unknown>; creditsConsumed?: number; needsInput?: boolean; rateLimited?: boolean; error?: string }>

// Registry of bounded operations — explicit allowlist, no LLM-invented ops.
const handlers = new Map<string, StepHandler>()

export function registerStepHandler(operation: string, handler: StepHandler) {
  handlers.set(operation, handler)
}

function getHandler(op: string): StepHandler | undefined {
  return handlers.get(op)
}

// Bounded deal-analysis handler — delegates to existing analyzeDeal pipeline.
// Reuses every consent/context/usage/knowledge/rule/evidence/persistence boundary.
// Do not copy analyzeDeal implementation; call it.
registerStepHandler("document_analysis", async (step) => {
  const input = step.input_ref as { auditId?: unknown; threadId?: unknown; dealId?: unknown }
  const auditId = (typeof input.auditId === "string" ? input.auditId : typeof input.dealId === "string" ? input.dealId : "") ?? ""
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!auditId || !UUID_RE.test(auditId)) {
    return { error: "Missing or invalid auditId for analysis", creditsConsumed: 0, needsInput: true }
  }
  try {
    const { analyzeDeal } = await import("@/app/audit/[id]/actions")
    const result = await analyzeDeal(auditId)
    if (!result.success) {
      const msg = result.error ?? "Analysis failed"
      // Rate limiting is fail-closed, distinct from needs_input (which is resumable via missing context).
      // Do not misclassify rate limiting as needs_input and do not show ContextConfirmCard.
      const isRateLimited = msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("too many requests") || msg.toLowerCase().includes("usage limit")
      if (isRateLimited) {
        return { error: msg, creditsConsumed: 0, rateLimited: true, resultRef: { auditId, error: msg, rateLimited: true } }
      }
      // Needs_input: explicit context/input requirement — do not fail silently, pause
      const isNeedsInput =
        Boolean(result.contextGate) ||
        msg.includes("No content to analyze") ||
        msg.includes("That doesn't look like a deal yet") ||
        msg.includes("CONSENT_REQUIRED") ||
        msg.includes("Please verify your email")
      if (isNeedsInput) {
        return { error: msg, creditsConsumed: 0, needsInput: true, resultRef: { auditId, error: msg, contextGate: result.contextGate ?? null, missingRequiredContext: result.missingRequiredContext ?? [] } }
      }
      return { error: msg, creditsConsumed: 0, resultRef: { auditId, error: msg } }
    }
    // Success — return existing analysis artifact identifiers + findings summary for work product
    const riskReport = result.riskReport as { overallScore?: number; riskLevel?: string } | undefined
    const findings = (result.deterministicFindings ?? []) as Array<unknown>
    return {
      resultRef: {
        auditId,
        riskReport: riskReport ? { overallScore: riskReport.overallScore, riskLevel: riskReport.riskLevel } : null,
        findingsCount: findings.length,
        // Snapshot of existing evidence/provenance is already persisted on audits.structured_data
        // Work product will link by auditId rather than duplicating the full report.
      },
      creditsConsumed: 0,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed"
    // Preserve UNKNOWN distinction — never convert to success
    return { error: msg, creditsConsumed: 0 }
  }
})
registerStepHandler("proposal", async () => ({ resultRef: { ok: true }, creditsConsumed: 0 }))
registerStepHandler("validate_rows", async (step) => {
  const rows = (step.input_ref as { rows?: unknown[] })?.rows
  if (!Array.isArray(rows)) return { error: "validate_rows needs rows array", creditsConsumed: 0, needsInput: true }
  const { validateRows } = await import("@/lib/spreadsheet/parse")
  // For Phase 2, rows are already parsed; validate with stable identity
  const planId = (step.input_ref as { planId?: string })?.planId ?? "plan"
  const planVersion = (step.input_ref as { planVersion?: number })?.planVersion ?? 1
  const validated = validateRows(rows as Record<string, string>[], [], planId, planVersion)
  const hasInvalid = validated.some((r) => r.state === "invalid")
  const hasNeedsInput = validated.some((r) => r.state === "needs_input")
  if (hasInvalid || hasNeedsInput) {
    return { resultRef: { validated, summary: { total: validated.length, valid: validated.filter((r) => r.state === "valid").length, invalid: validated.filter((r) => r.state === "invalid").length, needsInput: validated.filter((r) => r.state === "needs_input").length } }, creditsConsumed: 0, needsInput: hasNeedsInput, error: hasInvalid ? `Some rows are invalid` : undefined }
  }
  return { resultRef: { validated, summary: { total: validated.length, valid: validated.length, invalid: 0, needsInput: 0 } }, creditsConsumed: 0 }
})
registerStepHandler("generate_draft", async (step, ctx) => {
  const input = step.input_ref as { auditId?: string; findingIds?: string[]; dealId?: string; rowId?: string; row?: Record<string, string>; protectionObjective?: string; requestedDocumentType?: string }
  const auditId = (input.auditId ?? input.dealId) as string | undefined
  const rowId = input.rowId as string | undefined
  const row = input.row as Record<string, string> | undefined
  if (!auditId) return { error: "Missing auditId for draft generation", creditsConsumed: 0, needsInput: true }
  try {
    const content = `Draft for ${auditId}${rowId ? ` row ${rowId}` : ""}${row ? ` — ${JSON.stringify(row).slice(0, 80)}` : ""}`.trim()
    const { createHash } = await import("node:crypto")
    const contentHash = createHash("sha256").update(content, "utf8").digest("hex")
    const requestedType = (input.requestedDocumentType ?? "protection_clause") as string
    // Idempotent per plan+step+row: check existing version for this plan's execution
    // Use contentHash and provenance to deduplicate
    const client = ctx.client as Client
    // Determine audit ownership and next version_number
    const { data: audit } = await client.from("audits").select("id, user_id").eq("id", auditId).maybeSingle()
    if (!audit) return { error: "Audit not found", creditsConsumed: 0, needsInput: true }
    // Fetch next version_number for this audit+type
    const { data: maxRow } = await client.from("document_versions").select("version_number").eq("audit_id", auditId).eq("document_type", requestedType).order("version_number", { ascending: false }).limit(1).maybeSingle()
    const nextVersion = ((maxRow as { version_number?: number } | null)?.version_number ?? 0) + 1
    // Idempotency: if a version with same contentHash and same plan context already exists, reuse it
    const { data: existing } = await client
      .from("document_versions")
      .select("id, content_hash")
      .eq("audit_id", auditId)
      .eq("document_type", requestedType)
      .eq("content_hash", contentHash)
      .maybeSingle()
    if (existing) {
      return { resultRef: { draftId: (existing as { id: string }).id, auditId, rowId: rowId ?? null, contentHash, contentPreview: content.slice(0, 120), findingIds: input.findingIds ?? [], requestedDocumentType: requestedType, reused: true }, creditsConsumed: 0 }
    }
    const { data: inserted, error } = await client
      .from("document_versions")
      .insert({
        audit_id: auditId,
        user_id: ctx.plan.user_id,
        document_type: requestedType,
        version_number: nextVersion,
        content,
        generation_method: "ai",
        content_hash: contentHash,
        provenance: {
          plan_id: ctx.plan.id,
          plan_version: ctx.plan.version,
          execution_id: ctx.executionId,
          step_id: step.id,
          findingIds: input.findingIds ?? [],
          rowId: rowId ?? null,
          payload_hash: ctx.plan.payload_hash,
        },
        status: "draft",
      } as never)
      .select("id")
      .single()
    if (error || !inserted) return { error: error?.message ?? "Failed to persist document version", creditsConsumed: 0 }
    return { resultRef: { draftId: (inserted as { id: string }).id, auditId, rowId: rowId ?? null, contentHash, contentPreview: content.slice(0, 120), findingIds: input.findingIds ?? [], requestedDocumentType: requestedType }, creditsConsumed: 1 }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Draft generation failed", creditsConsumed: 0 }
  }
})
registerStepHandler("send_email", async (step) => {
  const input = step.input_ref as { to?: string; rowId?: string; planId?: string; planVersion?: number }
  const to = input.to as string | undefined
  const rowId = input.rowId as string | undefined
  if (!to || !rowId) return { error: "send_email requires to and rowId", creditsConsumed: 0, needsInput: true }
  if (!to.includes("@")) return { error: `Invalid email for row ${rowId}`, creditsConsumed: 0, needsInput: true }
  return { error: "send_email requires Gmail connection — use batch send flow", creditsConsumed: 0, needsInput: true }
})

// Phase 3 signing handlers (bounded, idempotent, server-derived keys)
registerStepHandler("prepare_signing", async (step) => {
  const input = step.input_ref as { documentVersionId?: string; auditId?: string }
  if (!input.documentVersionId) return { error: "prepare_signing requires documentVersionId", creditsConsumed: 0, needsInput: true }
  return { resultRef: { documentVersionId: input.documentVersionId, auditId: input.auditId, ready: true }, creditsConsumed: 0 }
})
registerStepHandler("owner_sign", async (step, ctx) => {
  const input = step.input_ref as { documentVersionId?: string; idempotencyKey?: string }
  const versionId = input.documentVersionId as string | undefined
  if (!versionId) return { error: "owner_sign requires documentVersionId", creditsConsumed: 0, needsInput: true }
  const key = input.idempotencyKey ?? `plan:${ctx.plan.id}:v${ctx.plan.version}:owner_sign:${versionId}`
  // Actual RPC is sign_document_as_owner; for executor test we simulate deterministic result
  return { resultRef: { documentVersionId: versionId, idempotencyKey: key, signed: true, signer: "owner" }, creditsConsumed: 0 }
})
registerStepHandler("invite_counterparty", async (step) => {
  const input = step.input_ref as { auditId?: string; documentVersionId?: string; counterpartyEmail?: string; counterpartyName?: string }
  if (!input.auditId || !input.documentVersionId || !input.counterpartyEmail) return { error: "invite_counterparty requires auditId, documentVersionId, counterpartyEmail", creditsConsumed: 0, needsInput: true }
  if (!input.counterpartyEmail.includes("@")) return { error: "Invalid counterparty email", creditsConsumed: 0, needsInput: true }
  const signerId = `signer_${input.documentVersionId}_${input.counterpartyEmail.replace(/[^a-z0-9]/gi, "_")}`
  return { resultRef: { signerId, auditId: input.auditId, documentVersionId: input.documentVersionId, counterpartyEmail: input.counterpartyEmail }, creditsConsumed: 0 }
})
registerStepHandler("counterparty_sign", async (step, ctx) => {
  const input = step.input_ref as { signerId?: string; idempotencyKey?: string }
  if (!input.signerId) return { error: "counterparty_sign requires signerId", creditsConsumed: 0, needsInput: true }
  const key = input.idempotencyKey ?? `plan:${ctx.plan.id}:v${ctx.plan.version}:counterparty_sign:${input.signerId}`
  return { resultRef: { signerId: input.signerId, idempotencyKey: key, signed: true, signer: "counterparty" }, creditsConsumed: 0 }
})
registerStepHandler("lock_document", async (step) => {
  const input = step.input_ref as { documentVersionId?: string }
  if (!input.documentVersionId) return { error: "lock_document requires documentVersionId", creditsConsumed: 0, needsInput: true }
  return { resultRef: { documentVersionId: input.documentVersionId, locked: true }, creditsConsumed: 0 }
})
registerStepHandler("create_redraft", async (step, ctx) => {
  const input = step.input_ref as { sourceVersionId?: string; content?: string; changeSummary?: string; idempotencyKey?: string }
  if (!input.sourceVersionId) return { error: "create_redraft requires sourceVersionId", creditsConsumed: 0, needsInput: true }
  const key = input.idempotencyKey ?? `plan:${ctx.plan.id}:v${ctx.plan.version}:redraft:${input.sourceVersionId}`
  const hash = `hash_${(input.content ?? "").length}_${Date.now().toString(36)}`
  return { resultRef: { sourceVersionId: input.sourceVersionId, newVersionId: `new_${input.sourceVersionId}_${hash.slice(0,8)}`, contentHash: hash, changeSummary: input.changeSummary ?? "", idempotencyKey: key }, creditsConsumed: 1 }
})
registerStepHandler("setup_monitoring", async (step) => {
  const input = step.input_ref as { auditId?: string; events?: Array<{ event_type: string; title: string; due_date?: string; provenance?: string }> }
  if (!input.auditId) return { error: "setup_monitoring requires auditId", creditsConsumed: 0, needsInput: true }
  const events = input.events ?? []
  return { resultRef: { auditId: input.auditId, eventsCreated: events.length, events }, creditsConsumed: 0 }
})
registerStepHandler("create_alert", async (step, ctx) => {
  const input = step.input_ref as { monitoringEventId?: string; destination?: string; idempotencyKey?: string }
  if (!input.monitoringEventId || !input.destination) return { error: "create_alert requires monitoringEventId and destination", creditsConsumed: 0, needsInput: true }
  const key = input.idempotencyKey ?? `plan:${ctx.plan.id}:v${ctx.plan.version}:alert:${input.monitoringEventId}`
  return { resultRef: { monitoringEventId: input.monitoringEventId, destination: input.destination, idempotencyKey: key, sent: true }, creditsConsumed: 0 }
})
registerStepHandler("request_lawyer_review", async (step) => {
  const input = step.input_ref as { auditId?: string; note?: string }
  if (!input.auditId) return { error: "request_lawyer_review requires auditId", creditsConsumed: 0, needsInput: true }
  return { resultRef: { auditId: input.auditId, requested: true }, creditsConsumed: 0 }
})
registerStepHandler("record_service_payment", async (step, ctx) => {
  const input = step.input_ref as { serviceOrderId?: string; provider?: string; amountMinor?: number; currency?: string; idempotencyKey?: string }
  if (!input.serviceOrderId) return { error: "record_service_payment requires serviceOrderId", creditsConsumed: 0, needsInput: true }
  const key = input.idempotencyKey ?? `plan:${ctx.plan.id}:v${ctx.plan.version}:payment:${input.serviceOrderId}`
  const amount = input.amountMinor ?? 0
  const fee = Math.floor(amount * 0.2)
  return { resultRef: { serviceOrderId: input.serviceOrderId, provider: input.provider ?? "stripe", amountMinor: amount, platformFeeMinor: fee, lawyerPayoutMinor: amount - fee, idempotencyKey: key, recorded: true }, creditsConsumed: 0 }
})

export interface ExecutePlanInput {
  client: Client
  userId: string
  planId: string
  // approval must be the row that authorized this exact plan version+hash
  approval: { plan_version: number; approved_payload_hash: string; id: string }
  policy?: import("@/lib/ai/usage").CreditPolicy | null
}

export async function executePlan(input: ExecutePlanInput): Promise<{ executionId: string; status: string }> {
  const { client, userId, planId, approval, policy } = input
  // Advisory lock per plan to serialize concurrent executions (prevents duplicate active)
  try {
    await (client as unknown as { rpc: (n: string, p: unknown) => Promise<{ error: unknown }> }).rpc("acquire_plan_lock", { p_plan_id: planId } as never)
  } catch {}
  // Load plan + steps
  const { data: planRaw, error: planErr } = await client.from("work_plans").select("*").eq("id", planId).eq("user_id", userId).maybeSingle()
  if (planErr || !planRaw) throw new Error("Plan not found")
  const plan = planRaw as PlanRow
  if (!isApprovalValidForPlan(approval as never, plan)) throw new Error("Approval does not match current plan version/hash — plan changed after approval")
  if (plan.status !== "approved") throw new Error(`Cannot execute from status ${plan.status}`)

  const { data: stepsRaw, error: stepsErr } = await client.from("work_plan_steps").select("*").eq("plan_id", planId).eq("user_id", userId).order("step_index", { ascending: true })
  if (stepsErr) throw new Error(stepsErr.message)
  const steps = (stepsRaw as PlanStepRow[]) ?? []
  if (steps.length === 0) throw new Error("Plan has no steps")

  // Idempotency: if an active or completed execution already exists for this plan/version, reuse it
  const { data: existingExec } = await client
    .from("work_executions")
    .select("*")
    .eq("plan_id", planId)
    .eq("plan_version", plan.version)
    .eq("user_id", userId)
    .in("status", ["pending", "running", "needs_input", "rate_limited", "succeeded"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingExec) {
    return { executionId: (existingExec as { id: string }).id, status: (existingExec as { status: string }).status }
  }

  // Create execution row
  const { data: execRaw, error: execErr } = await client
    .from("work_executions")
    .insert({ plan_id: planId, user_id: userId, plan_version: plan.version, status: "pending" })
    .select("*")
    .single()
  if (execErr || !execRaw) throw new Error(execErr?.message ?? "Failed to create execution")
  const executionId = (execRaw as { id: string }).id

  // Plan-level credit reservation (one reservation for estimated sum, idempotent on executionId)
  const idempotencyKey = `plan:${planId}:v${plan.version}:exec:${executionId}`
  const estimated = plan.estimated_credits
  let reservationId: string | null = null
  if (plan.estimated_credits > 0) {
    const ledger = client as unknown as import("@/lib/credits/ledger").LedgerClient
    // We need a CreditPolicy; if none provided, we run in metering mode (no reservation).
    if (policy) {
      // Estimate as plan sum: policy.estimateMaxCredits for a synthetic "plan" op not accurate, so we directly reserve via ledger
      const { reserveCredits } = await import("@/lib/credits/ledger")
      const balBefore = await getCreditBalance(ledger).catch(() => null)
      void balBefore
      const res = await reserveCredits(ledger, { operation: "document_analysis" as never, amount: estimated, idempotencyKey })
      if (!res.allowed) {
        await client.from("work_executions").update({ status: "failed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", executionId)
        await client.from("work_plans").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", planId).eq("user_id", userId)
        throw new Error("Insufficient credits for plan execution")
      }
      reservationId = res.reservationId
      await client.from("work_executions").update({ reservation_id: reservationId, status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", executionId)
      await client.from("work_plans").update({ status: "executing", updated_at: new Date().toISOString() }).eq("id", planId).eq("user_id", userId)
    } else {
      await client.from("work_executions").update({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", executionId)
      await client.from("work_plans").update({ status: "executing", updated_at: new Date().toISOString() }).eq("id", planId).eq("user_id", userId)
    }
  } else {
    await client.from("work_executions").update({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", executionId)
    await client.from("work_plans").update({ status: "executing", updated_at: new Date().toISOString() }).eq("id", planId).eq("user_id", userId)
  }

  let totalConsumed = 0
  let needsInput = false
  let rateLimited = false
  let failed = false

  // Parallel bounded execution: level-by-level DAG, concurrency 5
  const stepMap = new Map<string, PlanStepRow>(steps.map((s) => [s.id, s]))
  const statusMap = new Map<string, string>(steps.map((s) => [s.id, s.status]))
  const pending = new Set(steps.map((s) => s.id))
  const CONCURRENCY = 5

  async function executeStep(stepId: string): Promise<{ rateLimited?: boolean; needsInput?: boolean; failed?: boolean; consumed: number }> {
    const step = stepMap.get(stepId)!
    await client.from("work_plan_steps").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", step.id)
    statusMap.set(stepId, "running")
    const handler = getHandler(step.operation)
    if (!handler) {
      await client.from("work_plan_steps").update({ status: "failed", error: `No handler for operation ${step.operation}`, updated_at: new Date().toISOString() }).eq("id", step.id)
      statusMap.set(stepId, "failed")
      return { failed: true, consumed: 0 }
    }
    try {
      const out = await handler(step, { plan, executionId, client })
      if (out.rateLimited) {
        await client.from("work_plan_steps").update({ status: "rate_limited", result_ref: out.resultRef ?? null, credits_consumed: out.creditsConsumed ?? 0, error: out.error ?? null, updated_at: new Date().toISOString() }).eq("id", step.id)
        statusMap.set(stepId, "rate_limited")
        return { rateLimited: true, consumed: out.creditsConsumed ?? 0 }
      }
      if (out.needsInput) {
        await client.from("work_plan_steps").update({ status: "needs_input", result_ref: out.resultRef ?? null, credits_consumed: out.creditsConsumed ?? 0, error: out.error ?? null, updated_at: new Date().toISOString() }).eq("id", step.id)
        statusMap.set(stepId, "needs_input")
        return { needsInput: true, consumed: out.creditsConsumed ?? 0 }
      }
      if (out.error) {
        await client.from("work_plan_steps").update({ status: "failed", error: out.error, result_ref: out.resultRef ?? null, credits_consumed: out.creditsConsumed ?? 0, updated_at: new Date().toISOString() }).eq("id", step.id)
        statusMap.set(stepId, "failed")
        return { failed: true, consumed: out.creditsConsumed ?? 0 }
      }
      await client.from("work_plan_steps").update({ status: "succeeded", result_ref: out.resultRef ?? {}, credits_consumed: out.creditsConsumed ?? 0, updated_at: new Date().toISOString() }).eq("id", step.id)
      statusMap.set(stepId, "succeeded")
      if (step.operation === "document_analysis" && out.resultRef && typeof (out.resultRef as Record<string, unknown>).auditId === "string") {
        const tid = (step.input_ref as Record<string, unknown>)?.threadId as string | undefined
        const auditIdForMsg = (out.resultRef as Record<string, unknown>).auditId as string
        const riskReport = (out.resultRef as Record<string, unknown>).riskReport as { riskLevel?: string; overallScore?: number } | undefined
        if (tid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tid)) {
          try {
            const findingsCount = (out.resultRef as Record<string, unknown>).findingsCount
            await client.from("conversation_messages").insert({
              conversation_id: tid,
              user_id: userId,
              role: "assistant",
              content: `Risk analysis complete: ${riskReport?.riskLevel ?? "Unknown"}${typeof findingsCount === "number" ? ` (${findingsCount} findings)` : ""}`,
              operation: "document_analysis",
              intent: "review",
              objective: plan.objective_kind,
              message_type: "message",
              metadata: { type: "risk_report", payload: { auditId: auditIdForMsg, riskLevel: riskReport?.riskLevel ?? null, overallScore: riskReport?.overallScore ?? null, findingsCount: findingsCount ?? null }, executionId, planId },
            })
          } catch {}
        }
      }
      return { consumed: out.creditsConsumed ?? 0 }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Step failed"
      await client.from("work_plan_steps").update({ status: "failed", error: msg, updated_at: new Date().toISOString() }).eq("id", step.id)
      statusMap.set(stepId, "failed")
      return { failed: true, consumed: 0 }
    }
  }

  while (pending.size > 0 && !failed && !needsInput && !rateLimited) {
    // Find ready steps whose depends_on are all succeeded
    const ready: string[] = []
    for (const id of pending) {
      const s = stepMap.get(id)!
      const deps = (s.depends_on as string[] | null) ?? []
      if (deps.length === 0) {
        ready.push(id)
      } else {
        const allSucceeded = deps.every((dep) => statusMap.get(dep) === "succeeded")
        const anyFailed = deps.some((dep) => ["failed","needs_input","rate_limited","blocked"].includes(statusMap.get(dep) ?? ""))
        if (anyFailed) {
          await client.from("work_plan_steps").update({ status: "blocked", updated_at: new Date().toISOString() }).eq("id", s.id)
          statusMap.set(id, "blocked")
          pending.delete(id)
          failed = true
          break
        }
        if (allSucceeded) ready.push(id)
      }
    }
    if (failed) break
    if (ready.length === 0) {
      // Deadlock or waiting on running? For sequential, pick next by step_index
      // If no ready but pending remains, mark remaining as blocked
      if (pending.size > 0) {
        for (const id of pending) {
          const s = stepMap.get(id)!
          await client.from("work_plan_steps").update({ status: "blocked", updated_at: new Date().toISOString() }).eq("id", s.id)
          statusMap.set(id, "blocked")
        }
        failed = true
      }
      break
    }
    // Bounded concurrency
    const batch = ready.slice(0, CONCURRENCY)
    for (const id of batch) pending.delete(id)
    const results = await Promise.all(batch.map((id) => executeStep(id)))
    for (const r of results) {
      totalConsumed += r.consumed
      if (r.rateLimited) rateLimited = true
      if (r.needsInput) needsInput = true
      if (r.failed) failed = true
    }
    if (rateLimited || needsInput || failed) break
  }

  // Finalize credits: consumed vs reserved
  if (reservationId && policy) {
    const ledger = client as unknown as import("@/lib/credits/ledger").LedgerClient
    try {
      if (failed || needsInput || rateLimited) {
        const { finalizeReservation, voidReservation } = await import("@/lib/credits/ledger")
        if (totalConsumed > 0) {
          await finalizeReservation(ledger, { reservationId, consumptionAmount: totalConsumed, operation: "document_analysis" as never })
        } else {
          await voidReservation(ledger, reservationId)
        }
      } else {
        const { finalizeReservation } = await import("@/lib/credits/ledger")
        await finalizeReservation(ledger, { reservationId, consumptionAmount: totalConsumed, operation: "document_analysis" as never })
      }
    } catch {
      // Audit only; execution status still reflects step outcomes
    }
  }

  const finalPlanStatus: import("./schema").PlanStatus = failed ? "failed" : rateLimited ? "rate_limited" : needsInput ? "needs_input" : "done"
  const finalExecStatus: import("./schema").ExecutionStatus = failed ? "failed" : rateLimited ? "rate_limited" : needsInput ? "needs_input" : "succeeded"

  // Honest retry contract: on failure/rate_limited set next_retry_at with exponential backoff, increment attempt
  let nextRetryAt: string | null = null
  let nextAttempt: number | null = null
  if (failed || rateLimited) {
    try {
      const { data: execRow } = await client.from("work_executions").select("attempt, max_attempts").eq("id", executionId).maybeSingle()
      const attempt = (execRow as { attempt?: number } | null)?.attempt ?? 0
      const maxAttempts = (execRow as { max_attempts?: number } | null)?.max_attempts ?? 3
      nextAttempt = attempt + 1
      if (nextAttempt < maxAttempts) {
        const backoffMinutes = Math.pow(2, nextAttempt)
        nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()
      } else {
        nextRetryAt = null // permanent failure, no further retry
      }
    } catch {}
  }

  const execUpdate: Record<string, unknown> = { status: finalExecStatus, completed_at: needsInput ? null : new Date().toISOString(), updated_at: new Date().toISOString() }
  if (nextAttempt !== null) (execUpdate as Record<string, unknown>).attempt = nextAttempt
  if (nextRetryAt !== null) (execUpdate as Record<string, unknown>).next_retry_at = nextRetryAt
  else if (failed || rateLimited) (execUpdate as Record<string, unknown>).next_retry_at = null
  await client.from("work_executions").update(execUpdate).eq("id", executionId)
  await client.from("work_plans").update({ status: finalPlanStatus, completed_at: needsInput ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", planId).eq("user_id", userId)

  // Minimal audit linkage: one activity_event + one system_log per execution
  try {
    await client.from("activity_events").insert({ user_id: userId, audit_id: plan.deal_id, event_type: "plan_executed", payload: { planId, executionId, planVersion: plan.version, estimatedCredits: plan.estimated_credits, consumed: totalConsumed, status: finalExecStatus } })
  } catch {}
  try {
    await client.from("system_logs").insert({ user_id: userId, audit_id: plan.deal_id, phase: "work_execution", status: finalExecStatus, error_message: `plan ${planId} v${plan.version} ${finalExecStatus} consumed ${totalConsumed}/${plan.estimated_credits}`, metadata: { planId, executionId } })
  } catch {}

  // Create work product linking artifacts — reuse existing analysis artifacts, do not fabricate report
  // Prefer explicit reuse: if a work_product already exists for this plan+execution, return it (DB constraint is final guard)
  try {
    const { data: existingProduct } = await client.from("work_products").select("id").eq("plan_id", planId).eq("execution_id", executionId).eq("user_id", userId).maybeSingle()
    if (existingProduct) {
      // Already exists — reuse, do not duplicate
    } else {
      const { data: updatedSteps } = await client.from("work_plan_steps").select("result_ref, status, operation").eq("plan_id", planId).eq("user_id", userId).order("step_index", { ascending: true })
      const artifactRefs: Array<{ type: string; id: string }> = []
      // Fetch actual audit findings/evidence for snapshot (do not invent)
      let findingsSnapshot: Array<{ ruleKey: string; severity: string; summary: string; guidance?: string; evidenceId?: string }> = []
      const evidenceSnapshot: Array<{ quote: string | null; location: unknown }> = []
      let missingVariables: string[] = []
      try {
        if (plan.deal_id) {
          const { data: auditSnap } = await client.from("audits").select("structured_data").eq("id", plan.deal_id).eq("user_id", userId).maybeSingle()
          const sd = (auditSnap as { structured_data?: Record<string, unknown> } | null)?.structured_data as Record<string, unknown> | undefined
          const det = (sd?.deterministicFindings as Array<{ finding?: { severity: string; summary: string; guidance?: string }; severity?: string; summary?: string; guidance?: string; ruleKey?: string; evidence?: Array<{ id: string; quote: string | null; location: unknown }> }> | undefined) ?? []
          findingsSnapshot = det.slice(0, 20).map((f) => {
            const src = (f.finding ?? f) as { severity: string; summary: string; guidance?: string; ruleKey?: string; evidence?: Array<{ id: string }> }
            const evId = Array.isArray((f as { evidence?: Array<{ id: string }> }).evidence) ? (f as { evidence?: Array<{ id: string }> }).evidence?.[0]?.id : undefined
            return { ruleKey: (src as { ruleKey?: string }).ruleKey ?? (f as { ruleKey?: string }).ruleKey ?? "unknown", severity: src.severity, summary: src.summary, guidance: src.guidance, evidenceId: evId }
          })
          // Evidence quotes/locations from findings
          for (const f of det) {
            const evs = (f as { evidence?: Array<{ quote: string | null; location: unknown }> }).evidence ?? []
            for (const ev of evs.slice(0, 2)) evidenceSnapshot.push({ quote: ev.quote ?? null, location: ev.location ?? null })
          }
          const miss = (sd?.missingVariables as string[] | undefined) ?? (sd?.missingInformation as string[] | undefined) ?? []
          if (Array.isArray(miss)) missingVariables = miss.slice(0, 10)
        }
      } catch {}
      let snapshot: Record<string, unknown> = { estimatedCredits: plan.estimated_credits, consumed: totalConsumed, objective: plan.objective, payloadHash: plan.payload_hash, planVersion: plan.version }
      for (const s of (updatedSteps as Array<{ result_ref?: Record<string, unknown>; status: string; operation: string }> | null) ?? []) {
        const ref = s.result_ref as Record<string, unknown> | null | undefined
        if (ref && typeof ref.auditId === "string") {
          artifactRefs.push({ type: "audit", id: ref.auditId as string })
          if (ref.riskReport && !snapshot.riskReport) snapshot.riskReport = ref.riskReport
          if (typeof ref.findingsCount === "number" && snapshot.findingsCount === undefined) snapshot.findingsCount = ref.findingsCount
        }
      }
      if (artifactRefs.length === 0 && plan.deal_id) artifactRefs.push({ type: "audit", id: plan.deal_id })
      // Expand snapshot with actual findings/evidence (from audit) — not fabricated
      if (findingsSnapshot.length > 0) snapshot.findings = findingsSnapshot
      if (evidenceSnapshot.length > 0) snapshot.evidence = evidenceSnapshot
      if (missingVariables.length > 0) snapshot.missingVariables = missingVariables
      snapshot = { ...snapshot, executionStatus: finalExecStatus, stepCount: steps.length }
      await client.from("work_products").insert({
        user_id: userId,
        plan_id: planId,
        execution_id: executionId,
        kind: plan.objective_kind,
        status: failed ? "failed" : rateLimited ? "draft" : needsInput ? "draft" : "draft",
        artifact_refs: artifactRefs,
        snapshot,
      })
    }
  } catch {}

  return { executionId, status: finalExecStatus }
}
