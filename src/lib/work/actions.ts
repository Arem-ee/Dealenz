"use server"

import { createClient } from "@/lib/supabase/server"
import { createPlan, requestPlanApproval, approvePlan, rejectPlan } from "./store"
import { executePlan } from "./executor"
import { toActionFailure } from "@/lib/action-result"
import { ANALYSIS_CREDITS } from "@/lib/credits/pricing"
import { normalizeDealType } from "@/lib/deal-type"
import { validateBatchItems, type BatchAnalysisItem } from "./schema"

export type CreatePlanResult = { ok: true; planId: string } | { ok: false; error: string }
export type ApprovalResult = { ok: true; planId: string } | { ok: false; error: string }
export type ExecuteResult = { ok: true; executionId: string; status: string } | { ok: false; error: string }

// Email-verification policy (P0-3): work-plan mutations and execution are
// AI/cost-bearing (credits reserved, AI calls, possible external sends), so
// they require a verified email like analyzeDeal/generate/Ask. Pure reads
// below (getLatestPlanForThread, getWorkProductForPlan)
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
      // Analysis costs ANALYSIS_CREDITS, reserved by the executor at approval
      // execution and reported as measured consumption by the
      // document_analysis step. No free daily allowance: credits are the
      // only gate.
      steps: [{ operation: "document_analysis", inputRef: { auditId: input.dealId, threadId: input.conversationId }, estimatedCredits: ANALYSIS_CREDITS }],
    })
    return { ok: true, planId: plan.id }
  } catch (e) {
    return toActionFailure(e, "Could not create analysis plan.") as never
  }
}

// Batch auto-sort: propose a deal type per audit from its own contents.
// Deterministic keyword scan (no AI, no credits, no persistence) — the
// caller shows each guess for human override before plan creation. Weak or
// tied signals return generic, never a guessed vertical.
export async function suggestBatchDealTypes(input: {
  auditIds: string[]
}): Promise<{ ok: true; suggestions: Array<{ auditId: string; dealType: string }> } | { ok: false; error: string }> {
  try {
    const ids = [...new Set(input.auditIds ?? [])]
    if (ids.length === 0 || ids.length > 10) return { ok: false, error: "Send 1 to 10 deals for sorting." }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (ids.some((id) => !UUID_RE.test(id))) return { ok: false, error: "Invalid deal in batch." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    const { data: audits, error: auditsError } = await supabase
      .from("audits")
      .select("id, raw_input, structured_data")
      .eq("user_id", user.id)
      .in("id", ids)
    if (auditsError) return { ok: false, error: "We couldn't read your deals. Please try again." }
    if ((audits ?? []).length !== ids.length) return { ok: false, error: "One or more deals in the batch were not found." }
    const { extractTextFromBuffer } = await import("@/lib/text-extract")
    const { classifyDealTypeFromText } = await import("@/lib/deal-type")
    const suggestions: Array<{ auditId: string; dealType: string }> = []
    await Promise.all(
      ((audits ?? []) as Array<{ id: string; raw_input?: unknown; structured_data?: unknown }>).map(async (audit) => {
        const parts: string[] = []
        if (typeof audit.raw_input === "string" && audit.raw_input.trim().length > 0) parts.push(audit.raw_input)
        const files = ((audit.structured_data as Record<string, unknown> | null)?.files as Array<{ name?: string; type?: string; path?: string }> | undefined) ?? []
        for (const file of files) {
          if (typeof file.path !== "string" || typeof file.type !== "string") continue
          try {
            const { data: fileData } = await supabase.storage
              .from("audit-files")
              .download(file.path.replace("audit-files/", ""))
            if (!fileData) continue
            const text = await extractTextFromBuffer(Buffer.from(await fileData.arrayBuffer()), file.type)
            if (text.trim().length > 0) parts.push(text)
          } catch {
            // One unreadable file never blocks sorting the rest.
          }
        }
        // Keyword scan needs a sample, not the whole corpus: cap the scan so
        // a 10 MB deal cannot turn sorting into a slow pass.
        const sample = parts.join("\n\n").slice(0, 30000)
        suggestions.push({ auditId: audit.id, dealType: classifyDealTypeFromText(sample) })
      })
    )
    return { ok: true, suggestions }
  } catch (e) {
    return toActionFailure(e, "Could not sort the batch.") as never
  }
}

// Batch analysis: many contracts in, one multi-step analysis plan out. Each
// deal keeps its own audit and thread (risk reports land where they belong);
// a fresh batch thread hosts the shared plan so approval, execution, and
// cost stay in one place. Steps run through the unchanged
// document_analysis handler with its existing consent/context/credit
// boundaries, and analyses are not daily rate-limited — credits are the
// gate, so the whole batch prices as N × ANALYSIS_CREDITS up front.
export async function createBatchAnalysisPlan(input: {
  items: BatchAnalysisItem[]
}): Promise<{ ok: true; batchThreadId: string; planId: string } | { ok: false; error: string }> {
  try {
    const invalid = validateBatchItems(input.items ?? [])
    if (invalid) return { ok: false, error: invalid }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    // Ownership gate: every deal in the batch must belong to the caller.
    const auditIds = [...new Set(input.items.map((i) => i.auditId))]
    const { data: owned, error: ownedError } = await supabase
      .from("audits")
      .select("id, deal_type")
      .eq("user_id", user.id)
      .in("id", auditIds)
    if (ownedError) return { ok: false, error: "We couldn't verify your deals. Please try again." }
    if ((owned ?? []).length !== auditIds.length) return { ok: false, error: "One or more deals in the batch were not found." }
    // Auto-sort application: stamp each deal's final type (machine guess or
    // human override) before planning, so every step runs under the right
    // vertical's rules. Fresh batch audits carry no confirmations yet, so
    // re-seeding the envelope is safe — and machine guesses enter as
    // inferred (0.7, below the 0.75 confirmation threshold) so the confirm
    // card asks the user to verify the guess instead of trusting it.
    const storedTypes = new Map(
      ((owned ?? []) as Array<{ id: string; deal_type?: unknown }>).map((a) => [
        a.id,
        typeof a.deal_type === "string" ? a.deal_type : "",
      ])
    )
    const needsTyping = input.items.some(
      (item) => typeof item.dealType === "string" && item.dealType.length > 0 && normalizeDealType(item.dealType, "generic") !== storedTypes.get(item.auditId)
    )
    if (needsTyping) {
      const { seedEnvelopeWithProfile } = await import("@/lib/standing/profile")
      for (const item of input.items) {
        if (typeof item.dealType !== "string" || item.dealType.length === 0) continue
        const finalType = normalizeDealType(item.dealType, "generic")
        if (finalType === storedTypes.get(item.auditId)) continue
        const seeded = await seedEnvelopeWithProfile(supabase as never, user.id, finalType)
        if (item.autoDetected) {
          (seeded as { fields: { dealType: unknown } }).fields.dealType = {
            value: finalType,
            source: "inferred",
            confidence: 0.7,
          }
        }
        const envelopeJson = JSON.parse(JSON.stringify(seeded)) as never
        const { error: typeError } = await supabase
          .from("audits")
          .update({
            deal_type: finalType,
            context_envelope: envelopeJson,
            context_version: seeded.version,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.auditId)
          .eq("user_id", user.id)
        if (typeError) return { ok: false, error: "We couldn't set a deal's type. Please try again." }
      }
    }
    const { createConversation } = await import("@/lib/conversation/store")
    const batch = await createConversation(supabase as never, user.id, {
      firstText: `Batch analysis of ${auditIds.length} deal${auditIds.length === 1 ? "" : "s"}`,
    })
    const { plan } = await createPlan(supabase as never, user.id, {
      conversationId: batch.id,
      dealId: null,
      objective: `Analyze ${auditIds.length} deal${auditIds.length === 1 ? "" : "s"} in one batch`,
      objectiveKind: "deal_analysis",
      steps: input.items.map((item) => ({
        operation: "document_analysis",
        inputRef: { auditId: item.auditId, threadId: item.threadId },
        dependsOn: [],
        estimatedCredits: ANALYSIS_CREDITS,
      })),
    })
    await requestPlanApproval(supabase as never, user.id, plan.id)
    return { ok: true, batchThreadId: batch.id, planId: plan.id }
  } catch (e) {
    return toActionFailure(e, "Could not create batch analysis.") as never
  }
}

export async function getLatestPlanForThread(threadId: string): Promise<{ ok: true; plan: import("./schema").PlanRow | null; steps: import("./schema").PlanStepRow[]; execution: import("./schema").WorkExecutionRow | null } | { ok: false; error: string }> {  try {
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
