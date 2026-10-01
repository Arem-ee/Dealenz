"use client"

import { useState } from "react"
import Link from "next/link"
import { Inbox as InboxIcon, MailOpen, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

type Filter = "all" | "unread" | "done"

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "done", label: "Done" },
]

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: "j / k", action: "move down / up" },
  { keys: "Enter", action: "open thread" },
  { keys: "e", action: "mark done, move on" },
  { keys: "s", action: "snooze to Later, move on" },
  { keys: "?", action: "toggle shortcuts" },
]

// Inbox foreground: layout and states only. Threads, connection, triage
// actions, and shortcuts wire up when the tab gets its functions.
export function InboxView() {
  const [filter, setFilter] = useState<Filter>("all")

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Inbox</h1>
        <Link
          href="/chat/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Import
        </Link>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-4" aria-label="Filter threads">
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

      <div className="flex min-h-0 flex-1 flex-col gap-px border border-border bg-border md:flex-row">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-background px-4 py-12 text-center">
          <InboxIcon className="h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Connect Gmail to fill your inbox</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Deal threads arrive here for triage. Connection wires up with this tab&apos;s functions.
          </p>
        </div>
        <div className="hidden min-h-0 flex-1 flex-col items-center justify-center bg-background px-4 py-12 text-center md:flex">
          <MailOpen className="h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Select a thread</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            The reading pane opens here.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border border-t-0 border-border bg-background px-3 py-2" aria-label="Keyboard shortcuts">
        {SHORTCUTS.map((s) => (
          <span key={s.keys} className="text-[11px] text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{s.keys}</span> — {s.action}
          </span>
        ))}
      </div>
    </div>
  )
}
