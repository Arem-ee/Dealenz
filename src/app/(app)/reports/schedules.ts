"use server"

import { createClient } from "@/lib/supabase/server"
import { isSupportedTimezone } from "@/lib/reports/schedules"

export interface ScheduleView {
  id: string
  reportId: string
  reportName: string
  metricTitle: string
  cadence: "weekly" | "monthly"
  timezone: string
  sendHour: number
  sendWeekday: number | null
  active: boolean
  expiresAt: string
  lastRunAt: string | null
  createdAt: string
}

export interface RunView {
  id: string
  scheduleId: string
  status: "sent" | "skipped_empty" | "failed"
  rowCount: number
  channel: "email" | "in_app"
  error: string
  createdAt: string
}

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

/** Creates a schedule on an owned saved report. Weekly needs a weekday. */
export async function createSchedule(input: {
  reportId: string
  cadence: string
  timezone: string
  sendHour: number
  sendWeekday?: number | null
}): Promise<ActionOk<{ schedule: ScheduleView }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (input.cadence !== "weekly" && input.cadence !== "monthly") {
    return { ok: false, error: "Cadence is weekly or monthly." }
  }
  if (!isSupportedTimezone(input.timezone)) return { ok: false, error: "Pick a supported timezone." }
  const hour = Math.floor(input.sendHour)
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return { ok: false, error: "Hour is 0–23." }
  let weekday: number | null = null
  if (input.cadence === "weekly") {
    const day = input.sendWeekday
    if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) {
      return { ok: false, error: "Pick a weekday for weekly schedules." }
    }
    weekday = day
  }
  const { data: report } = await supabase
    .from("saved_reports")
    .select("id, name, metric")
    .eq("id", (input.reportId ?? "").trim())
    .eq("user_id", user.id)
    .maybeSingle()
  if (!report) return { ok: false, error: "Saved report not found." }
  const { metricById } = await import("@/lib/analytics/catalog")
  const { data, error } = await supabase
    .from("report_schedules")
    .insert({
      user_id: user.id,
      saved_report_id: (report as { id: string }).id,
      cadence: input.cadence,
      timezone: input.timezone,
      send_hour: hour,
      send_weekday: weekday,
      active: true,
    })
    .select("id, saved_report_id, cadence, timezone, send_hour, send_weekday, active, expires_at, last_run_at, created_at")
    .single()
  if (error || !data) return { ok: false, error: "We couldn't save that schedule. Please try again." }
  const row = data as {
    id: string; saved_report_id: string; cadence: "weekly" | "monthly"; timezone: string;
    send_hour: number; send_weekday: number | null; active: boolean; expires_at: string;
    last_run_at: string | null; created_at: string
  }
  return {
    ok: true,
    schedule: {
      id: row.id,
      reportId: row.saved_report_id,
      reportName: (report as { name: string }).name,
      metricTitle: metricById((report as { metric: string }).metric)?.title ?? (report as { metric: string }).metric,
      cadence: row.cadence,
      timezone: row.timezone,
      sendHour: row.send_hour,
      sendWeekday: row.send_weekday,
      active: row.active,
      expiresAt: row.expires_at,
      lastRunAt: row.last_run_at,
      createdAt: row.created_at,
    },
  }
}

export async function listSchedules(): Promise<ActionOk<{ schedules: ScheduleView[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data, error } = await supabase
    .from("report_schedules")
    .select("id, saved_report_id, cadence, timezone, send_hour, send_weekday, active, expires_at, last_run_at, created_at, saved_reports!inner(name, metric)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) {
    if (error.message.includes("report_schedules")) {
      return { ok: false, error: "Schedules need a database update (migration 00126). Please try again after migrating." }
    }
    return { ok: false, error: "We couldn't load your schedules. Please try again." }
  }
  const { metricById } = await import("@/lib/analytics/catalog")
  type ScheduleRow = {
    id: string; saved_report_id: string; cadence: "weekly" | "monthly"; timezone: string;
    send_hour: number; send_weekday: number | null; active: boolean; expires_at: string;
    last_run_at: string | null; created_at: string;
    saved_reports: { name: string; metric: string } | Array<{ name: string; metric: string }> | null
  }
  const rows = ((data ?? []) as unknown as ScheduleRow[]).map((r) => {
    const joined = Array.isArray(r.saved_reports) ? r.saved_reports[0] ?? null : r.saved_reports
    return {
      id: r.id,
      reportId: r.saved_report_id,
      reportName: joined?.name ?? "Report",
      metricTitle: metricById(joined?.metric ?? "")?.title ?? joined?.metric ?? "",
      cadence: r.cadence,
      timezone: r.timezone,
      sendHour: r.send_hour,
      sendWeekday: r.send_weekday,
      active: r.active,
      expiresAt: r.expires_at,
      lastRunAt: r.last_run_at,
      createdAt: r.created_at,
    }
  })
  return {
    ok: true,
    schedules: rows,
  }
}

/** Pause/resume (the in-app unsubscribe equivalent) or delete outright. */
export async function setScheduleActive(input: {
  id: string
  active: boolean
}): Promise<ActionOk<{ active: boolean }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { error } = await supabase
    .from("report_schedules")
    .update({ active: input.active })
    .eq("id", (input.id ?? "").trim())
    .eq("user_id", user.id)
  if (error) return { ok: false, error: "We couldn't update that schedule. Please try again." }
  return { ok: true, active: input.active }
}

export async function deleteSchedule(input: {
  id: string
}): Promise<ActionOk<{ deleted: boolean }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { error } = await supabase
    .from("report_schedules")
    .delete()
    .eq("id", (input.id ?? "").trim())
    .eq("user_id", user.id)
  if (error) return { ok: false, error: "We couldn't delete that schedule. Please try again." }
  return { ok: true, deleted: true }
}

export async function listRunHistory(input: {
  scheduleId: string
}): Promise<ActionOk<{ runs: RunView[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: schedule } = await supabase
    .from("report_schedules")
    .select("id")
    .eq("id", (input.scheduleId ?? "").trim())
    .eq("user_id", user.id)
    .maybeSingle()
  if (!schedule) return { ok: false, error: "Schedule not found." }
  const { data, error } = await supabase
    .from("report_runs")
    .select("id, schedule_id, status, row_count, channel, error, created_at")
    .eq("schedule_id", (schedule as { id: string }).id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) return { ok: false, error: "We couldn't load run history. Please try again." }
  return {
    ok: true,
    runs: ((data ?? []) as Array<{
      id: string; schedule_id: string; status: string; row_count: number;
      channel: string; error: string; created_at: string
    }>)
      .filter((r) => (r.status === "sent" || r.status === "skipped_empty" || r.status === "failed")
        && (r.channel === "email" || r.channel === "in_app"))
      .map((r) => ({
        id: r.id,
        scheduleId: r.schedule_id,
        status: r.status as RunView["status"],
        rowCount: r.row_count,
        channel: r.channel as RunView["channel"],
        error: r.error,
        createdAt: r.created_at,
      })),
  }
}
