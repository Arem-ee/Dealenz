"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarClock, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

type Filter = "all" | "obligations" | "renewals" | "deadlines"

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "obligations", label: "Obligations" },
  { key: "renewals", label: "Renewals" },
  { key: "deadlines", label: "Deadlines" },
]

// Tracker foreground: layout and states only. Monitored events, deadline
// extraction, alerts, and done/dismiss actions wire up when the tab gets
// its functions.
export function TrackerView() {
  const [filter, setFilter] = useState<Filter>("all")

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Tracker</h1>
        <Link
          href="/audit/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Watch
        </Link>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-4" aria-label="Filter watched items">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "border px-2.5 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-foreground bg-muted font-semibold text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="border border-dashed px-4 py-12 text-center">
        <CalendarClock className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Nothing being tracked</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Obligations, renewals, and deadlines from your signed deals appear here with due dates. Monitoring and alerts wire up with this tab&apos;s functions.
        </p>
      </div>
    </div>
  )
}
