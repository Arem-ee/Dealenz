"use client"

import { useState } from "react"
import Link from "next/link"
import { FileText, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

type KindFilter = "all" | "agreement" | "terms" | "schedule"
type StatusFilter = "all" | "draft" | "review" | "signed"

const KINDS: Array<{ key: KindFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "agreement", label: "Agreements" },
  { key: "terms", label: "Terms" },
  { key: "schedule", label: "Schedules" },
]

const STATUSES: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "review", label: "In review" },
  { key: "signed", label: "Signed" },
]

// Drafts foreground: layout and states only. Generated documents, versions,
// and generation actions wire up when the tab gets its functions.
export function DraftsView() {
  const [kind, setKind] = useState<KindFilter>("all")
  const [status, setStatus] = useState<StatusFilter>("all")

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Drafts</h1>
        <Link
          href="/chat/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New document
        </Link>
      </div>

      <div className="flex shrink-0 flex-col gap-2 pb-4">
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by kind">
          <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kind</span>
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              aria-pressed={kind === k.key}
              className={cn(
                "border px-2.5 py-1 text-xs font-medium transition-colors",
                kind === k.key
                  ? "border-foreground bg-muted font-semibold text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by status">
          <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatus(s.key)}
              aria-pressed={status === s.key}
              className={cn(
                "border px-2.5 py-1 text-xs font-medium transition-colors",
                status === s.key
                  ? "border-foreground bg-muted font-semibold text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-dashed px-4 py-12 text-center">
        <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">No drafts yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Generate a document from a deal and it lands here with its versions. Generation wires up with this tab&apos;s functions.
        </p>
      </div>
    </div>
  )
}
