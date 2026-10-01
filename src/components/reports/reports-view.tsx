"use client"

import { BarChart3, Plus } from "lucide-react"

const STATS = ["Total deals", "Open issues", "Signed this month", "Credits used"]

const CHARTS = [
  { title: "Deals by stage", desc: "Analysis, negotiation, signing, signed." },
  { title: "Risk split", desc: "Critical, material, attention, clear." },
]

// Reports foreground: layout and states only. Portfolio stats, charts, and
// custom report building wire up when the tab gets its functions.
export function ReportsView() {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Reports</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Charts, reports, and custom analytics.
          </p>
        </div>
        <span className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground opacity-40" aria-disabled="true">
          <Plus className="h-3.5 w-3.5" />
          New report
        </span>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4" aria-label="Portfolio stats">
        {STATS.map((s) => (
          <div key={s} className="bg-background px-4 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-muted-foreground">—</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid shrink-0 grid-cols-1 gap-4 md:grid-cols-2">
        {CHARTS.map((c) => (
          <div key={c.title} className="border border-border bg-background p-4">
            <p className="text-sm font-semibold">{c.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p>
            <div className="mt-3 flex h-40 items-center justify-center border border-dashed px-4 text-center">
              <p className="text-xs text-muted-foreground">No data yet — charts render with this tab&apos;s functions.</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border border-dashed px-4 py-10 text-center">
        <BarChart3 className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">No custom reports yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Build and save your own views over deals, clauses, and obligations. The builder wires up with this tab&apos;s functions.
        </p>
      </div>
    </div>
  )
}
