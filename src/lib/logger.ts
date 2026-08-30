import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface LogEntry {
  audit_id?: string | null
  user_id?: string | null
  phase: string
  status: "start" | "success" | "failure"
  error_message?: string | null
  duration_ms?: number | null
}

export async function logEvent(entry: LogEntry) {
  const supabase = await createClient()
  const { error } = await supabase.from("system_logs").insert({
    audit_id: entry.audit_id ?? null,
    user_id: entry.user_id ?? null,
    phase: entry.phase,
    status: entry.status,
    error_message: entry.error_message ?? null,
    duration_ms: entry.duration_ms ?? null,
    created_at: new Date().toISOString(),
  })
  if (error) {
    console.error("Logging failed:", error.message)
  }
}

export async function logEventWithClient(
  supabase: SupabaseClient,
  entry: LogEntry
) {
  const { error } = await supabase.from("system_logs").insert({
    audit_id: entry.audit_id ?? null,
    user_id: entry.user_id ?? null,
    phase: entry.phase,
    status: entry.status,
    error_message: entry.error_message ?? null,
    duration_ms: entry.duration_ms ?? null,
    created_at: new Date().toISOString(),
  })
  if (error) {
    console.error("Middleware logging failed:", error.message)
  }
}

export function logDuration(startMs: number): number {
  return Date.now() - startMs
}
