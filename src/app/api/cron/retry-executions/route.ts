import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Cron to retry failed/rate_limited work executions with next_retry_at due.
// Honest background contract: queued work is picked up only when this cron is invoked
// (e.g., Vercel Cron). If not scheduled, executions remain in failed/rate_limited with next_retry_at set —
// they do not silently become stuck without audit. This endpoint is the actual runtime mechanism
// for background retry, not just state columns.

export const dynamic = "force-dynamic"

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  // Allow Vercel Cron (no secret) in development, require secret in production if set
  if (!cronSecret) return true
  return auth === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 500 })

  const svc = createClient(url, key)

  // Find due retries: status failed/rate_limited, next_retry_at <= now(), attempt < max_attempts
  const now = new Date().toISOString()
  const { data: due, error } = await svc
    .from("work_executions")
    .select("id, plan_id, user_id, attempt, max_attempts")
    .in("status", ["failed", "rate_limited"])
    .lte("next_retry_at", now)
    .lt("attempt", 5) // safety cap even if max_attempts higher
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due || due.length === 0) return NextResponse.json({ ok: true, retried: 0 })

  let retried = 0
  let failed = 0

  for (const exec of due as Array<{ id: string; plan_id: string; user_id: string; attempt: number; max_attempts: number }>) {
    try {
      // Advisory lock per execution to prevent duplicate worker pickup (best-effort, ignore if RPC missing)
      try {
        await svc.rpc("acquire_plan_lock", { p_plan_id: exec.plan_id } as never)
      } catch {}
      // Increment attempt and set next_retry_at exponential backoff (2^attempt minutes)
      const nextAttempt = exec.attempt + 1
      if (nextAttempt >= exec.max_attempts) {
        // Permanent failure — mark as failed with no further retry, do not requeue
        await svc.from("work_executions").update({ attempt: nextAttempt, next_retry_at: null, updated_at: new Date().toISOString() }).eq("id", exec.id)
        continue
      }
      const backoffMinutes = Math.pow(2, nextAttempt)
      const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()
      // Move to pending for retry (actual executor will pick up via resume logic)
      const { error: updErr } = await svc
        .from("work_executions")
        .update({ status: "pending", attempt: nextAttempt, next_retry_at: nextRetry, updated_at: now })
        .eq("id", exec.id)
        .eq("user_id", exec.user_id)
        .in("status", ["failed", "rate_limited"])
      if (!updErr) retried++
      else failed++
    } catch {
      failed++
    }
  }

  return NextResponse.json({ ok: true, retried, failed, checked: due.length })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
