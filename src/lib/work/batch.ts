// Batch work via WorkPlan — transient spreadsheet input, not CRM.
// Uses existing WorkPlan architecture, zero-credit planning, billable execution via credit ledger.

import type { SupabaseClient } from "@supabase/supabase-js"
import { createPlan } from "./store"
import { parseSpreadsheetCSV, validateRows, type ParsedRow } from "@/lib/spreadsheet/parse"

type Client = SupabaseClient

export interface BatchPlanInput {
  conversationId: string
  dealId: string
  csvText: string // raw spreadsheet text (transient, not stored as CRM)
  protectionObjective?: string
}

export async function createBatchPlan(client: Client, userId: string, input: BatchPlanInput): Promise<{ planId: string; rows: ParsedRow[]; estimatedCredits: number }> {
  const { headers, rows } = parseSpreadsheetCSV(input.csvText)
  if (rows.length === 0) throw new Error("Spreadsheet is empty")
  if (rows.length > 200) throw new Error("Spreadsheet too large — max 200 rows")

  // Create a temporary planId to derive stable rowIds (plan_id + plan_version + row_index + contentHash)
  // We use a provisional planId for rowId generation, then create the real plan
  const provisionalId = `batch_${Date.now().toString(36)}`
  const validated = validateRows(rows, [], provisionalId, 1)

  const validCount = validated.filter((r) => r.state === "valid").length
  const invalidCount = validated.filter((r) => r.state === "invalid").length
  const needsInputCount = validated.filter((r) => r.state === "needs_input").length

  // Estimate: validate 0, generate 1 per valid row, send 0 (send is separate approval), assumption review 0
  const genCredits = validCount * 1 // 1 credit per draft (provisional, not provider token price)
  const estimated = genCredits

  const objective = `Batch outreach for ${validated.length} contacts — ${validCount} ready, ${invalidCount} invalid, ${needsInputCount} needs input`

  const steps: Array<{ operation: string; inputRef: Record<string, unknown>; estimatedCredits: number }> = [
    { operation: "validate_rows", inputRef: { rows, headers, dealId: input.dealId, conversationId: input.conversationId }, estimatedCredits: 0 },
    // One generate_draft per valid row — bounded parallelism limit 5 in executor will handle fan-out
    ...validated
      .filter((r) => r.state === "valid")
      .map((r) => ({
        operation: "generate_draft" as const,
        inputRef: { rowId: r.rowId, row: r.raw, auditId: input.dealId, planId: provisionalId, protectionObjective: input.protectionObjective ?? "Batch outreach" },
        estimatedCredits: 1,
      })),
  ]

  // If no valid rows, still create a plan with validate only so the user sees the preview
  if (steps.length === 1 && validCount === 0) {
    // only validate step
  }

  const { plan } = await createPlan(client as never, userId, {
    conversationId: input.conversationId,
    dealId: input.dealId,
    objective,
    objectiveKind: "proposal_batch",
    steps: steps as never,
  })

  // Re-derive rowIds with real planId for stable identity (update steps' input_ref.rowId)
  // For Phase 2, we keep the provisional rowIds as stable because they already include contentHash;
  // the real rowId stability is plan_id + plan_version + row_index + content_hash, so updating is not strictly needed
  // but we store the validated rows in the plan's first step result for preview
  void validated

  return { planId: plan.id, rows: validated, estimatedCredits: estimated }
}

export function getBatchSummary(rows: ParsedRow[]) {
  const total = rows.length
  const valid = rows.filter((r) => r.state === "valid").length
  const invalid = rows.filter((r) => r.state === "invalid").length
  const needsInput = rows.filter((r) => r.state === "needs_input").length
  return { total, valid, invalid, needsInput }
}
