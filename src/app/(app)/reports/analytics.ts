"use server"

import { createClient } from "@/lib/supabase/server"
import { normalizeRuleDealTypes } from "@/lib/standing/rules"
import {
  ANALYTICS_ROW_CAP,
  metricById,
  METRICS,
  type MetricParams,
  type MetricResult,
} from "@/lib/analytics/catalog"

export interface SavedReportView {
  id: string
  name: string
  metricId: string
  metricTitle: string
  dealTypes: string[]
  sinceDays: number
  createdAt: string
}

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

function validatedParams(input: { dealTypes?: string[]; sinceDays?: number }): MetricParams {
  const sinceDays = input.sinceDays === 30 || input.sinceDays === 365 ? input.sinceDays : 90
  return {
    dealTypes: normalizeRuleDealTypes(input.dealTypes).filter((t) => t !== "generic"),
    sinceDays,
  }
}

/** Composed metric run. Same code path and RLS as static aggregates. */
export async function runMetric(input: {
  metricId: string
  dealTypes?: string[]
  sinceDays?: number
}): Promise<ActionOk<{ result: MetricResult; cappedAt: number }> | ActionFail> {
  const metric = metricById((input.metricId ?? "").trim())
  if (!metric) return { ok: false, error: "Unknown metric." }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  try {
    const result = await metric.run(supabase as never, user.id, validatedParams(input))
    return { ok: true, result, cappedAt: ANALYTICS_ROW_CAP }
  } catch {
    return { ok: false, error: "That metric failed — please try again." }
  }
}

export async function listMetricCatalog(): Promise<
  ActionOk<{ metrics: Array<{ id: string; title: string; desc: string }> }> | ActionFail
> {
  return {
    ok: true,
    metrics: METRICS.map((m) => ({ id: m.id, title: m.title, desc: m.desc })),
  }
}

export async function saveReport(input: {
  name: string
  metricId: string
  dealTypes?: string[]
  sinceDays?: number
}): Promise<ActionOk<{ report: SavedReportView }> | ActionFail> {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : ""
  if (!name) return { ok: false, error: "Name the report first." }
  const metric = metricById((input.metricId ?? "").trim())
  if (!metric) return { ok: false, error: "Unknown metric." }
  const params = validatedParams(input)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data, error } = await supabase
    .from("saved_reports")
    .insert({ user_id: user.id, name, metric: metric.id, params })
    .select("id, name, metric, params, created_at")
    .single()
  if (error || !data) return { ok: false, error: "We couldn't save that report. Please try again." }
  const row = data as { id: string; name: string; metric: string; params: unknown; created_at: string }
  const stored = (row.params ?? {}) as { dealTypes?: unknown; sinceDays?: unknown }
  return {
    ok: true,
    report: {
      id: row.id,
      name: row.name,
      metricId: row.metric,
      metricTitle: metric.title,
      dealTypes: Array.isArray(stored.dealTypes) ? stored.dealTypes.filter((t): t is string => typeof t === "string") : [],
      sinceDays: stored.sinceDays === 30 || stored.sinceDays === 365 ? stored.sinceDays : 90,
      createdAt: row.created_at,
    },
  }
}

export async function listSavedReports(): Promise<ActionOk<{ reports: SavedReportView[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data, error } = await supabase
    .from("saved_reports")
    .select("id, name, metric, params, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100)
  if (error) {
    if (error.message.includes("saved_reports")) {
      return { ok: false, error: "Custom analytics needs a database update (migration 00120). Please try again after migrating." }
    }
    return { ok: false, error: "We couldn't load your reports. Please try again." }
  }
  return {
    ok: true,
    reports: ((data ?? []) as Array<{
      id: string; name: string; metric: string; params: unknown; created_at: string
    }>).map((r) => {
      const stored = (r.params ?? {}) as { dealTypes?: unknown; sinceDays?: unknown }
      return {
        id: r.id,
        name: r.name,
        metricId: r.metric,
        metricTitle: metricById(r.metric)?.title ?? r.metric,
        dealTypes: Array.isArray(stored.dealTypes) ? stored.dealTypes.filter((t): t is string => typeof t === "string") : [],
        sinceDays: stored.sinceDays === 30 || stored.sinceDays === 365 ? stored.sinceDays : 90,
        createdAt: r.created_at,
      }
    }),
  }
}

export async function deleteSavedReport(input: {
  id: string
}): Promise<ActionOk<{ deleted: boolean }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { error } = await supabase
    .from("saved_reports")
    .delete()
    .eq("id", (input.id ?? "").trim())
    .eq("user_id", user.id)
  if (error) return { ok: false, error: "We couldn't delete that report. Please try again." }
  return { ok: true, deleted: true }
}
