"use client"

import { useEffect, useState } from "react"
import { BarChart3, Download, Loader2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { toCsv } from "@/lib/reports/stats"
import {
  deleteSavedReport,
  listMetricCatalog,
  listSavedReports,
  runMetric,
  saveReport,
  type SavedReportView,
} from "@/app/(app)/reports/analytics"
import type { MetricResult } from "@/lib/analytics/catalog"

const DEAL_TYPES = ["founder", "partnership", "purchase_sale", "lease", "employment", "freelance"]
const WINDOWS = [30, 90, 365] as const

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function toCsvSafe(result: MetricResult): string {
  return toCsv(
    result.columns.map((c) => c.key),
    result.rows.map((r) => result.columns.map((c) => String(r[c.key] ?? "")))
  )
}

// Custom analytics: composed metrics from the exposed catalog — filters,
// grouping, saved/rerunnable, CSV. Same RLS-scoped code path as the fixed
// aggregates; users compose, never write SQL.
export function AnalyticsSection() {
  const { showError } = useToast()
  const [catalog, setCatalog] = useState<Array<{ id: string; title: string; desc: string }> | null>(null)
  const [metricId, setMetricId] = useState("fallback_acceptance")
  const [dealTypes, setDealTypes] = useState<string[]>([])
  const [sinceDays, setSinceDays] = useState<number>(90)
  const [result, setResult] = useState<MetricResult | null>(null)
  const [running, setRunning] = useState(false)
  const [saved, setSaved] = useState<SavedReportView[] | null>(null)
  const [reportName, setReportName] = useState("")

  useEffect(() => {
    let live = true
    Promise.all([listMetricCatalog(), listSavedReports()])
      .then(([c, s]) => {
        if (!live) return
        if (c.ok) setCatalog(c.metrics)
        if (!s.ok) showError(s.error, "Saved reports failed to load")
        else setSaved(s.reports)
        if (!s.ok) setSaved([])
      })
      .catch(() => {
        if (!live) return
        showError("Analytics failed to load")
        setSaved([])
      })
    return () => {
      live = false
    }
  }, [showError])

  async function run(metric: string, types: string[], days: number) {
    setRunning(true)
    setResult(null)
    try {
      const res = await runMetric({ metricId: metric, dealTypes: types, sinceDays: days })
      if (!res.ok) throw new Error(res.error)
      setResult(res.result)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Metric failed.")
    } finally {
      setRunning(false)
    }
  }

  async function refreshSaved() {
    const s = await listSavedReports()
    if (s.ok) setSaved(s.reports)
  }

  async function handleSave() {
    if (!reportName.trim()) return
    try {
      const res = await saveReport({ name: reportName, metricId, dealTypes, sinceDays })
      if (!res.ok) throw new Error(res.error)
      setReportName("")
      await refreshSaved()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Report not saved.")
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await deleteSavedReport({ id })
      if (!res.ok) throw new Error(res.error)
      await refreshSaved()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Report not deleted.")
    }
  }

  const metric = (catalog ?? []).find((m) => m.id === metricId)

  return (
    <div className="mt-4 border border-border bg-background p-4" aria-label="Custom analytics">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Custom metrics
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Compose from the metric catalog — same scoped data as the fixed reports.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Metric</span>
          <select
            value={metricId}
            onChange={(e) => setMetricId(e.target.value)}
            aria-label="Metric"
            className="h-9 border border-input bg-background px-2 text-sm outline-none"
          >
            {(catalog ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        {metric ? <p className="text-[11px] text-muted-foreground">{metric.desc}</p> : null}
        <div className="flex flex-wrap gap-1.5" aria-label="Filter by deal type">
          {DEAL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={dealTypes.includes(t)}
              onClick={() =>
                setDealTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
              }
              className={cn(
                "border px-2 py-1 text-[11px] font-medium transition-colors",
                dealTypes.includes(t)
                  ? "border-foreground bg-muted font-semibold text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {t.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Trailing window">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={sinceDays === w}
              onClick={() => setSinceDays(w)}
              className={cn(
                "border px-2 py-1 text-[11px] font-medium transition-colors",
                sinceDays === w
                  ? "border-foreground bg-muted font-semibold text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {w}d
            </button>
          ))}
          <button
            type="button"
            onClick={() => void run(metricId, dealTypes, sinceDays)}
            disabled={running}
            className="inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {running ? "Running." : "Run metric"}
          </button>
        </div>
      </div>

      {result ? (
        <div className="mt-3 border border-border" aria-label="Metric results">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <p className="text-xs font-semibold">
              {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
              {result.truncated ? " · capped at 500" : ""}
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => downloadCsv(`${metricId}.csv`, toCsvSafe(result))}
                aria-label="Download results as CSV"
                className="flex items-center gap-1 border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
            </div>
          </div>
          {result.rows.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">No rows in this window — widen it or clear filters.</p>
          ) : (
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                    {result.columns.map((c) => (
                      <th key={c.key} scope="col" className="px-3 py-1.5 font-semibold">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      {result.columns.map((c) => (
                        <td key={c.key} className="max-w-64 truncate px-3 py-1.5 tabular-nums">
                          {String(r[c.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-1.5 border-t border-border p-2">
            <input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              maxLength={80}
              placeholder="Save as, e.g. Q3 fallback review"
              aria-label="Report name"
              className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/60"
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!reportName.trim()}
              className="h-8 shrink-0 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              Save report
            </button>
          </div>
        </div>
      ) : null}

      {saved !== null && saved.length > 0 ? (
        <div className="mt-3" aria-label="Saved reports">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Saved reports</p>
          <ul className="mt-1.5 space-y-1.5">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{s.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {s.metricTitle} · {s.sinceDays}d
                    {s.dealTypes.length > 0 ? ` · ${s.dealTypes.map((t) => t.replace("_", " ")).join(", ")}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMetricId(s.metricId)
                      setDealTypes(s.dealTypes)
                      setSinceDays(s.sinceDays)
                      void run(s.metricId, s.dealTypes, s.sinceDays)
                    }}
                    className="h-7 border border-border px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Run
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete report: ${s.name}`}
                    onClick={() => void handleDelete(s.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
