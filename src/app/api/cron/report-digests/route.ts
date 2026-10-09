import type { ReactElement } from "react"
import { NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { isScheduleDue } from "@/lib/reports/schedules"
import { metricById } from "@/lib/analytics/catalog"
import { cronQuota, isCronAuthorized, logCronDenied } from "@/lib/cron/guard"

// Hourly digest sweep: active, unexpired schedules due now run their saved
// report as the owner (RLS-equivalent scoping: every query filters
// user_id = schedule owner, same rows their UI returns). Empty results
// deliver nothing (logged skipped_empty). Email sends when configured;
// the owner always gets an in-app notification. Failed runs leave
// last_run_at untouched so the next hourly pass retries them.

export const dynamic = "force-dynamic"

function isAuthorized(req: NextRequest): boolean {
  return isCronAuthorized(req)
}

interface DueScheduleRow {
  id: string
  user_id: string
  saved_report_id: string
  cadence: "weekly" | "monthly"
  timezone: string
  send_hour: number
  send_weekday: number | null
  expires_at: string | null
  last_run_at: string | null
}

export async function GET(req: NextRequest) {
  if (!(await cronQuota(req))) return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  if (!isAuthorized(req)) {
    await logCronDenied("report-digests")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 500 })

  const svc = createClient(url, key)
  const now = new Date()
  const result: Record<string, unknown> = { ok: true, sent: 0, skipped: 0, failed: 0 }

  const { data: schedules, error } = await svc
    .from("report_schedules")
    .select("id, user_id, saved_report_id, cadence, timezone, send_hour, send_weekday, expires_at, last_run_at")
    .eq("active", true)
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  for (const s of ((schedules ?? []) as DueScheduleRow[])) {
    if (s.cadence !== "weekly" && s.cadence !== "monthly") continue
    try {
      if (!isScheduleDue(
        {
          cadence: s.cadence, timezone: s.timezone, sendHour: s.send_hour,
          sendWeekday: s.send_weekday, active: true, expiresAt: s.expires_at, lastRunAt: s.last_run_at,
        },
        now
      )) {
        continue
      }
      const outcome = await runSchedule(svc, s, now)
      if (outcome === "skipped") result.skipped = (result.skipped as number) + 1
      else result.sent = (result.sent as number) + 1
    } catch (err) {
      result.failed = (result.failed as number) + 1
      try {
        await svc.from("report_runs").insert({
          schedule_id: s.id,
          user_id: s.user_id,
          status: "failed",
          row_count: 0,
          channel: "email",
          error: err instanceof Error ? err.message.slice(0, 500) : "Digest failed.",
        })
      } catch {
        // The failure is already counted; the row is best-effort.
      }
    }
  }
  return NextResponse.json(result)
}

async function runSchedule(
  svc: SupabaseClient,
  schedule: DueScheduleRow,
  now: Date
): Promise<"sent" | "skipped"> {
  const { data: report } = await svc
    .from("saved_reports")
    .select("id, name, metric, params")
    .eq("id", schedule.saved_report_id)
    .eq("user_id", schedule.user_id)
    .maybeSingle()
  const saved = report as {
    id: string; name: string; metric: string;
    params: { dealTypes?: unknown; sinceDays?: unknown }
  } | null
  if (!saved) throw new Error("Saved report is gone.")
  const metric = metricById(saved.metric)
  if (!metric) throw new Error("Metric is gone.")
  const dealTypes = Array.isArray(saved.params?.dealTypes)
    ? (saved.params.dealTypes as unknown[]).filter((t): t is string => typeof t === "string")
    : []
  const sinceDays = saved.params?.sinceDays === 30 || saved.params?.sinceDays === 365 ? saved.params.sinceDays : 90
  const outcome = await metric.run(svc as never, schedule.user_id, { dealTypes, sinceDays })
  if (outcome.rows.length === 0) {
    // Empty-digest rule: deliver nothing, log the skip.
    await svc.from("report_runs").insert({
      schedule_id: schedule.id,
      user_id: schedule.user_id,
      status: "skipped_empty",
      row_count: 0,
      channel: "email",
      error: "",
    })
    await svc.from("report_schedules").update({ last_run_at: now.toISOString() }).eq("id", schedule.id)
    return "skipped"
  }

  const windowLabel = `trailing ${sinceDays}d`
  const headline = `${saved.name}: ${outcome.rows.length} row${outcome.rows.length === 1 ? "" : "s"}`;
  const topRows = outcome.rows.slice(0, 5).map((r) => ({
    title: String(r[metricTitleOf(outcome)] ?? Object.values(r)[0] ?? "Row"),
    summary: summaryOfRow(r),
  }))

  let emailed = false
  const { isEmailConfigured, sendEmail } = await import("@/lib/email/send")
  if (isEmailConfigured()) {
    try {
      const { data: { user } } = await svc.auth.admin.getUserById(schedule.user_id)
      const to = user?.email ?? ""
      if (to) {
        const { DigestEmail } = await import("@/lib/email/templates/digest")
        const element = DigestEmail({
          reportName: saved.name,
          metricTitle: metric.title,
          windowLabel,
          headline,
          metrics: topRows,
          manageUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reports`,
        }) as unknown as ReactElement
        await sendEmail({
          to,
          subject: headline,
          react: element,
          idempotencyKey: `report-run:${schedule.id}:${now.toISOString().slice(0, 13)}`,
        })
        emailed = true
      }
    } catch {
      emailed = false
    }
  }

  const { createNotification } = await import("@/lib/notifications/store")
  try {
    await createNotification(svc as never, {
      userId: schedule.user_id,
      type: "status",
      title: emailed ? `Digest sent: ${saved.name}` : `Digest ready: ${saved.name}`,
      body: emailed
        ? `${headline} — emailed with top rows attached.`
        : `${headline} — email isn't configured, see the full run in Reports.`,
      link: "/reports",
      category: "deadline_digests",
    })
  } catch {
    // Notification is best-effort; the run row below is the record.
  }
  await svc.from("report_runs").insert({
    schedule_id: schedule.id,
    user_id: schedule.user_id,
    status: "sent",
    row_count: outcome.rows.length,
    channel: emailed ? "email" : "in_app",
    error: "",
  })
  await svc.from("report_schedules").update({ last_run_at: now.toISOString() }).eq("id", schedule.id)
  return "sent"
}

function metricTitleOf(outcome: { columns: Array<{ key: string; label: string }> }): string {
  return outcome.columns[0]?.key ?? ""
}

function summaryOfRow(row: Record<string, string | number>): string {
  const parts = Object.entries(row)
    .slice(1, 4)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
  return parts.join(" · ") || "Row recorded.";
}
