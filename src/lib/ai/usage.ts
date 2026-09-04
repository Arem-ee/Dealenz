// AI usage measurement and the credit boundary (pre-5D correction).
//
// Separates three concepts that must never be conflated:
//   provider token usage (measured facts from the model API),
//   AI operation (what the user asked Dealenz to do),
//   credit charge (a future commercial policy decision, not implemented here).
//
// The record below can represent both sides of that future conversion. There
// is deliberately no conversion rate, no price table, and no ledger in this
// phase: inventing them would be fabrication, and the existing
// usage_tracking counters plus billing page remain the only accounting until
// a real credit policy ships. See architecture.md for the required pre-flight
// boundary (estimate, check, execute, measure, apply, record).

import { logEvent } from "@/lib/logger"
import { totalTokens, type AIOperation, type TokenUsage } from "./operations"

export type { TokenUsage }

export type AIOperationStatus =
  | "pre_provider_failure"
  | "provider_failure"
  | "malformed_response"
  | "success"

export interface AIUsageRecord {
  operation: AIOperation
  provider: string
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  // Null until a real credit policy records a charge. A null charge means
  // "not charged under any policy", never "free" and never zero by default.
  creditsConsumed: number | null
  status: AIOperationStatus
  createdAt: string
}

export function toUsageRecord(input: {
  operation: AIOperation
  provider: string
  model: string
  usage?: TokenUsage
  status: AIOperationStatus
}): AIUsageRecord {
  const record: AIUsageRecord = {
    operation: input.operation,
    provider: input.provider,
    model: input.model,
    creditsConsumed: null,
    status: input.status,
    createdAt: new Date().toISOString(),
  }
  if (input.usage) {
    record.inputTokens = input.usage.inputTokens
    record.outputTokens = input.usage.outputTokens
    record.totalTokens = totalTokens(input.usage)
  }
  return record
}

// Future commercial policy (not configured). When it exists, estimateMax
// bounds a pre-flight credit check and creditsForUsage converts measured
// tokens into a charge. Provider tokens are an input to the policy, never
// the user's balance and never a 1:1 price unless explicitly decided.
export interface CreditPolicy {
  estimateMaxCredits(operation: AIOperation): number | null
  creditsForUsage(record: AIUsageRecord): number | null
}

function summarizeUsage(record: AIUsageRecord): string {
  const tokens =
    record.inputTokens !== undefined && record.outputTokens !== undefined
      ? `in=${record.inputTokens} out=${record.outputTokens}`
      : "tokens=unreported"
  return `${record.operation} via ${record.provider}/${record.model} ${tokens} status=${record.status}`
}

// Records a measurement row (metadata only: never prompts, documents, or
// keys). Best-effort like other logEvent callers; logging failures never fail
// the product operation.
export async function logAIUsage(record: AIUsageRecord): Promise<void> {
  await logEvent({
    phase: "ai_usage",
    status: record.status === "success" ? "success" : "failure",
    error_message: summarizeUsage(record),
  })
}
