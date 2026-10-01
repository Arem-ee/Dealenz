"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, ScrollText } from "lucide-react"
import { cn } from "@/lib/utils"

const DEAL_TYPES = ["Founder", "Partnership", "Purchase/Sale", "Lease", "Employment", "Freelance"]

const TRACKED_STATUSES = ["Suggested", "In draft", "Needs input", "Signed"]

// Clauses foreground: layout and states only. Template seeding, the
// suggestion engine, and draft-linking wire up when the tab gets its
// functions.
export function ClausesView() {
  const [dealType, setDealType] = useState<string>("All")

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Clauses</h1>
        <Link
          href="/audit/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New clause
        </Link>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-6" aria-label="Filter by deal type">
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

      <section aria-label="Clause library" className="shrink-0">
        <h2 className="text-sm font-semibold">Library</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drafting suggestions, never law — confirm enforceability with a lawyer when it matters.
        </p>
        <div className="mt-2 border border-dashed px-4 py-10 text-center">
          <ScrollText className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No clauses in the library yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Templates seed here with this tab&apos;s functions.
          </p>
        </div>
      </section>

      <section aria-label="Tracked clauses" className="mt-6 shrink-0">
        <h2 className="text-sm font-semibold">Tracked</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Every clause suggested or used in every deal, with its state.
        </p>
        <div className="mt-2 border border-dashed px-4 py-10 text-center">
          <p className="text-sm font-medium">Nothing tracked yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Clauses move through {TRACKED_STATUSES.join(" → ")} as deals progress. Tracking wires up with this tab&apos;s functions.
          </p>
        </div>
      </section>
    </div>
  )
}
