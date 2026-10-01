"use client"

import { useState } from "react"
import Link from "next/link"
import { PenLine, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "awaiting_me" | "awaiting_others" | "signed"

const STATUSES: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "awaiting_me", label: "Awaiting me" },
  { key: "awaiting_others", label: "Awaiting others" },
  { key: "signed", label: "Signed" },
]

// Signing foreground: layout and states only. Ceremonies, sends,
// countersigning, and the executed/locked lifecycle wire up when the tab
// gets its functions.
export function SigningView() {
  const [status, setStatus] = useState<StatusFilter>("all")

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Signing</h1>
        <Link
          href="/chat/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Send for signature
        </Link>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-4" aria-label="Filter by signing status">
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

      <div className="border border-dashed px-4 py-12 text-center">
        <PenLine className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">No ceremonies in flight</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Signature ceremonies appear here with whose turn it is and how many have signed. Sending and countersigning wire up with this tab&apos;s functions.
        </p>
      </div>
    </div>
  )
}
