"use client"

import { Columns2, Plus } from "lucide-react"

// Compare foreground: layout and states only. Document pickers, the
// line-level diff, and the material-difference summary wire up when the
// tab gets its functions.
export function CompareView() {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Compare</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Two documents, every material difference.
          </p>
        </div>
        <span className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground opacity-40" aria-disabled="true">
          <Plus className="h-3.5 w-3.5" />
          Pick documents
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-px border border-border bg-border md:flex-row" aria-label="Comparison slots">
        <div className="flex min-h-0 flex-1 flex-col bg-background px-4 py-8">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Left</p>
          <p className="mt-1 text-sm text-muted-foreground">No document picked.</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col bg-background px-4 py-8">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Right</p>
          <p className="mt-1 text-sm text-muted-foreground">No document picked.</p>
        </div>
      </div>

      <div className="mt-4 border border-dashed px-4 py-10 text-center">
        <Columns2 className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Pick two documents to compare</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Additions, removals, and changed language appear here with a material-difference summary. Comparison wires up with this tab&apos;s functions.
        </p>
      </div>
    </div>
  )
}
