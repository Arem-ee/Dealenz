"use client"

import { useState } from "react"
import { ClipboardCheck } from "lucide-react"
import { cn } from "@/lib/utils"

type Filter = "all" | "pending" | "decided"

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "decided", label: "Decided" },
]

// Approvals foreground: layout and states only. The decision queue — what
// was requested, what it costs or risks, approve or reject with audit
// trail — wires up when the tab gets its functions. Works solo (self-
// approval) today; delegation across the team arrives with the Team tab.
export function ApprovalsView() {
  const [filter, setFilter] = useState<Filter>("all")

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Approvals</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Nothing consequential runs without a decision.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-4" aria-label="Filter decisions">
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
        <ClipboardCheck className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Nothing awaiting decision</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Analyses, sends, and signatures pause here for your call, with the full audit trail behind each one. The queue wires up with this tab&apos;s functions.
        </p>
      </div>
    </div>
  )
}
