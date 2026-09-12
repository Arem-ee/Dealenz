import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  redactText,
  redactMetadata,
  MAX_LOG_MESSAGE,
  type LogScalar,
} from "@/lib/observability/redact"

export type LogSeverity = "debug" | "info" | "warn" | "error" | "critical"

export interface LogEntry {
  audit_id?: string | null
  user_id?: string | null
  phase: string
  status: "start" | "success" | "failure"
  error_message?: string | null
  duration_ms?: number | null
  severity?: LogSeverity
  metadata?: Record<string, LogScalar> | null
}

// Minimal client surface: the real Supabase client and test doubles satisfy
// this. Writes never throw — observability must not break product paths.
export interface LogDbClient {
  from(table: string): any // eslint-disable-line @typescript-eslint/no-explicit-any
}

function buildRow(entry: LogEntry): Record<string, unknown> {
  return {
    audit_id: entry.audit_id ?? null,
    user_id: entry.user_id ?? null,
    phase: entry.phase,
    status: entry.status,
    error_message:
      entry.error_message == null ? null : redactText(entry.error_message, MAX_LOG_MESSAGE),
    duration_ms: entry.duration_ms ?? null,
    severity: entry.severity ?? "info",
    metadata: redactMetadata(entry.metadata ?? undefined),
    created_at: new Date().toISOString(),
  }
}

export async function logEvent(entry: LogEntry) {
  const supabase = await createClient()
  const { error } = await supabase.from("system_logs").insert(buildRow(entry))
  if (error) {
    console.error("Logging failed:", error.message)
  }
}

export async function logEventWithClient(
  supabase: SupabaseClient,
  entry: LogEntry
) {
  const { error } = await supabase.from("system_logs").insert(buildRow(entry))
  if (error) {
    console.error("Middleware logging failed:", error.message)
  }
}

export function logDuration(startMs: number): number {
  return Date.now() - startMs
}

export interface ReportErrorInput {
  phase: string
  /** The failure itself: only its name/message are stored, never payloads. */
  error?: unknown
  /** Caller-provided scalar metadata only (surface, model, category, counts). Never deal content. */
  details?: Record<string, LogScalar> | null
  severity?: LogSeverity
  userId?: string | null
  auditId?: string | null
  opId?: string | null
  durationMs?: number | null
}

/**
 * Durable structured error record. Never throws and never stores sensitive
 * content: messages pass through redaction, details are scalar-only.
 * error/critical severities also fan out to the ops alert webhook (if
 * configured) without blocking the caller.
 */
export async function reportError(
  supabase: LogDbClient,
  input: ReportErrorInput
): Promise<void> {
  const severity = input.severity ?? "error"
  const metadata = redactMetadata(input.details ?? undefined)
  if (input.opId) metadata.op_id = redactText(input.opId, 128)
  try {
    const { error } = await supabase.from("system_logs").insert({
      audit_id: input.auditId ?? null,
      user_id: input.userId ?? null,
      phase: input.phase,
      status: "failure",
      error_message: input.error === undefined ? null : redactText(input.error, MAX_LOG_MESSAGE),
      duration_ms: input.durationMs ?? null,
      severity,
      metadata,
      created_at: new Date().toISOString(),
    })
    if (error) {
      console.error("Error reporting failed:", error.message)
    }
  } catch (err) {
    console.error("Error reporting failed:", err instanceof Error ? err.message : err)
  }
  if (severity === "error" || severity === "critical") {
    void sendOpsAlert({
      severity,
      phase: input.phase,
      summary: input.error === undefined ? "failure" : redactText(input.error, 300),
    })
  }
}

export interface AIFallbackInput {
  surface: string
  provider: string
  model?: string | null
  /** Machine failure category (timeout, rate_limit, provider, …). Never user content. */
  category?: string | null
  servedByFallback: boolean
  operation?: string | null
  userId?: string | null
  auditId?: string | null
  durationMs?: number | null
}

/**
 * Durable AI degradation record. Fallback-served calls are warn/success
 * (degraded but working); unserved failures are error/failure. Provider
 * internals beyond surface/provider/model/category are never stored, and
 * nothing here reaches ordinary users.
 */
export async function reportAIFallback(
  supabase: LogDbClient,
  input: AIFallbackInput
): Promise<void> {
  const details: Record<string, LogScalar> = {
    surface: input.surface,
    provider: input.provider,
    model: input.model ?? null,
    category: input.category ?? null,
    served_by_fallback: input.servedByFallback,
    operation: input.operation ?? null,
  }
  if (input.servedByFallback) {
    await reportError(supabase, {
      phase: "ai_fallback",
      error: `AI degraded on ${input.surface} (${input.provider})`,
      details,
      severity: "warn",
      userId: input.userId,
      auditId: input.auditId,
      durationMs: input.durationMs,
    })
  } else {
    await reportError(supabase, {
      phase: "ai_failure",
      error: `AI unavailable on ${input.surface} (${input.provider})`,
      details,
      severity: "error",
      userId: input.userId,
      auditId: input.auditId,
      durationMs: input.durationMs,
    })
  }
}

/**
 * Repeated-degradation check for /api/health: counts fallback/failure
 * events inside a trailing window. Returns spiking=true when the count
 * meets the threshold. Includes the legacy "risk_fallback" phase so
 * history written before structured ai_fallback events still counts.
 * Read-only; throws nothing (unknown on error).
 */
export const FALLBACK_PHASES = ["ai_fallback", "ai_failure", "risk_fallback"] as const

export async function getFallbackSpike(
  supabase: LogDbClient,
  windowMinutes = 60,
  threshold = 10
): Promise<{ count: number; spiking: boolean }> {
  try {
    const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()
    const { data, error } = await supabase
      .from("system_logs")
      .select("id")
      .in("phase", [...FALLBACK_PHASES])
      .gte("created_at", since)
      .limit(1000)
    if (error || !Array.isArray(data)) return { count: 0, spiking: false }
    const count = data.length
    return { count, spiking: count >= threshold }
  } catch {
    return { count: 0, spiking: false }
  }
}

export interface OpsAlert {
  severity: LogSeverity
  phase: string
  summary: string
}

/**
 * Minimal alert integration: a single generic HTTPS webhook (Slack,
 * Discord, PagerDuty Events-lite — anything accepting JSON). Server-only.
 * Best-effort and silent on failure; alerting must never break requests.
 */
export async function sendOpsAlert(alert: OpsAlert): Promise<boolean> {
  const url = process.env.OPS_ALERT_WEBHOOK
  if (!url || !/^https:\/\//.test(url)) return false
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `[dealenz:${alert.severity}] ${alert.phase}: ${redactText(alert.summary, 500)}`,
      }),
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}
