"use client"

import { useState } from "react"
import Link from "next/link"
import { FilePlus2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

const DEAL_TYPES = ["Founder", "Partnership", "Purchase/Sale", "Lease", "Employment", "Freelance"]

// Templates foreground: layout and states only. Standard templates,
// one-click creation, and variable prefill wire up when the tab gets
// its functions.
export function TemplatesView() {
  const [dealType, setDealType] = useState<string>("All")

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Templates</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Standard contracts, one click to a first draft.
          </p>
        </div>
        <Link
          href="/chat/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New template
        </Link>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-4" aria-label="Filter by deal type">
        {["All", ...DEAL_TYPES].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setDealType(t)}
            aria-pressed={dealType === t}
            className={cn(
              "border px-2.5 py-1 text-xs font-medium transition-colors",
              dealType === t
                ? "border-foreground bg-muted font-semibold text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="border border-dashed px-4 py-12 text-center">
        <FilePlus2 className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">No templates yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Standard starting points per deal type live here. Templates and one-click creation wire up with this tab&apos;s functions.
        </p>
      </div>
    </div>
  )
}
