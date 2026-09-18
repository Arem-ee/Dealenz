// Bounded work execution types (Phase 23C).
//
// Uses existing conventions: UUID (gen_random_uuid), TIMESTAMPTZ now(), RLS scoped to user_id.
// No new AI router/store/credit/evidence duplication. Bounded operations reuse AIOperation where
// appropriate; new deal-work ops are explicit and non-CRM.

import type { AIOperation } from "@/lib/ai/operations"

// Bounded deal-work operations (explicit allowlist). AI may propose a plan that sequences these;
// it must not invent an operation outside this set.
export const BOUNDED_OPERATIONS = [
  // Analysis (read-only)
  "document_analysis",
  "conversation",
  "explanation",
  "comparison",
  "decision_support",
  // Work-product generation
  "negotiation",
  "drafting",
  "proposal",
  // Bounded deal-work extensions (Phase 2)
  "validate_rows",
  "generate_draft",
  "send_email",
  // Signing lifecycle (Phase 3)
  "prepare_signing",
  "owner_sign",
  "invite_counterparty",
  "counterparty_sign",
  "lock_document",
  "create_redraft",
  // Monitoring (Phase 3)
  "setup_monitoring",
  "create_alert",
  // Lawyer + payment (Phase 3)
  "request_lawyer_review",
  "record_service_payment",
] as const

export type BoundedOperation = (typeof BOUNDED_OPERATIONS)[number] | AIOperation

export const PLAN_STATUSES = ["draft", "awaiting_approval", "approved", "executing", "needs_input", "rate_limited", "done", "failed", "canceled"] as const
export type PlanStatus = (typeof PLAN_STATUSES)[number]

export const STEP_STATUSES = ["pending", "ready", "running", "succeeded", "failed", "needs_input", "rate_limited", "blocked", "skipped"] as const
export type StepStatus = (typeof STEP_STATUSES)[number]

export const EXECUTION_STATUSES = ["pending", "running", "succeeded", "failed", "canceled", "needs_input", "needs_approval", "rate_limited"] as const
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number]

export const WORK_PRODUCT_KINDS = ["risk_report", "proposal_single", "proposal_batch", "protection", "document", "lawyer_handoff", "custom"] as const
export type WorkProductKind = (typeof WORK_PRODUCT_KINDS)[number]

export const WORK_PRODUCT_STATUSES = ["draft", "ready_to_send", "sent", "locked", "failed", "superseded"] as const
export type WorkProductStatus = (typeof WORK_PRODUCT_STATUSES)[number]

export const OBJECTIVE_KINDS = ["deal_analysis", "proposal_single", "proposal_batch", "protection", "lawyer_review", "custom"] as const
export type ObjectiveKind = (typeof OBJECTIVE_KINDS)[number]

export interface PlanStepInput {
  operation: string
  inputRef?: Record<string, unknown>
  dependsOn?: string[]
  estimatedCredits: number
}

export interface CreatePlanInput {
  userId: string
  conversationId?: string | null
  dealId?: string | null
  objective: string
  objectiveKind?: ObjectiveKind
  steps: PlanStepInput[]
}

export interface PlanRow {
  id: string
  user_id: string
  conversation_id: string | null
  deal_id: string | null
  objective: string
  objective_kind: ObjectiveKind
  version: number
  estimated_credits: number
  status: PlanStatus
  payload_hash: string
  approved_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface PlanStepRow {
  id: string
  plan_id: string
  user_id: string
  step_index: number
  operation: string
  input_ref: Record<string, unknown>
  depends_on: string[]
  estimated_credits: number
  status: StepStatus
  result_ref: Record<string, unknown> | null
  credits_consumed: number | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface WorkApprovalRow {
  id: string
  plan_id: string
  user_id: string
  plan_version: number
  scope: Record<string, unknown>
  approved_payload_hash: string
  actor_user_id: string
  approved_at: string
  expires_at: string | null
  idempotency_key: string
}

export interface WorkExecutionRow {
  id: string
  plan_id: string
  user_id: string
  plan_version: number
  reservation_id: string | null
  status: ExecutionStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface WorkProductRow {
  id: string
  user_id: string
  plan_id: string
  execution_id: string | null
  kind: WorkProductKind
  status: WorkProductStatus
  artifact_refs: Array<{ type: string; id: string }>
  snapshot: Record<string, unknown>
  created_at: string
  updated_at: string
}

// Validation helpers (pure, no DB)
const MAX_OBJECTIVE = 4000
const MAX_OPERATION = 40
const MAX_PAYLOAD_HASH = 200
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(v: unknown): boolean {
  return typeof v === "string" && UUID_RE.test(v)
}

export function validateCreatePlan(input: CreatePlanInput): string | null {
  if (!isUUID(input.userId)) return "Invalid userId"
  if (typeof input.objective !== "string" || input.objective.trim().length === 0 || input.objective.length > MAX_OBJECTIVE) return "Invalid objective"
  if (input.objectiveKind && !OBJECTIVE_KINDS.includes(input.objectiveKind as never)) return "Invalid objectiveKind"
  if (!Array.isArray(input.steps) || input.steps.length === 0 || input.steps.length > 50) return "Plan must have 1-50 steps"
  const ids = new Set<string>()
  for (let i = 0; i < input.steps.length; i += 1) {
    const s = input.steps[i]
    if (typeof s.operation !== "string" || s.operation.length === 0 || s.operation.length > MAX_OPERATION) return `Invalid operation at step ${i}`
    if (!Number.isInteger(s.estimatedCredits) || s.estimatedCredits < 0 || s.estimatedCredits > 1000) return `Invalid estimatedCredits at step ${i}`
    if (s.dependsOn) {
      if (!Array.isArray(s.dependsOn)) return `Invalid dependsOn at step ${i}`
      for (const dep of s.dependsOn) if (typeof dep !== "string") return `Invalid dependsOn entry at step ${i}`
    }
    // No duplicate implicit ids check here; ids are assigned on persist.
    void ids
  }
  return null
}

export function sumEstimatedCredits(steps: Array<{ estimatedCredits: number }>): number {
  return steps.reduce((a, s) => a + s.estimatedCredits, 0)
}

export function isValidPayloadHash(v: unknown): boolean {
  return typeof v === "string" && v.length >= 10 && v.length <= MAX_PAYLOAD_HASH
}
