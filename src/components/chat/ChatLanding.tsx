"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Composer } from "./Composer"
import { clearPendingDeal, getPendingDeal } from "@/lib/pending-deal"

interface ThreadItem {
  id: string
  title: string
  auditId: string | null
  updatedAt: string
  status?: string | null
}

function formatDate(date: string): string {
  const d = new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function statusLabel(status: string | null | undefined): string | null {
  if (!status) return null
  const map: Record<string, string> = {
    draft: "Draft",
    in_progress: "In progress",
    processing: "Analyzing",
    analyzed: "Analyzed",
    failed: "Needs attention",
  }
  return map[status] ?? null
}

/**
 * Deal-first Home: the loop promise up top, the composer, one understated
 * Library link, then recent deals with their state. No action cards, no
 * tours, no tooltips — the classifier routes whatever is typed, and the UI
 * stays out of its way.
 */
export function ChatLanding({ threads, loadError }: { threads: ThreadItem[]; loadError?: string | null }) {
  // Anonymous landing input waits here after signup/signin: prefill on every
  // fresh mount (the composer applies it once per key) and clear on the
  // first successful send, so intent survives navigation but never
  // resurrects after it is used.
  const [pendingPrefill] = useState<{ text: string; key: number } | null>(() => {
    const pending = getPendingDeal()
    if (!pending) return null
    return { text: pending, key: Date.now() }
  })
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-4">
      <div className="shrink-0 pb-3 pt-4 sm:pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--burgundy)]">Counterparty-side review</p>
        <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em] sm:text-[32px]">Send us their contract.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Get back what to push back on — in your words. Sign here. Stay guarded.</p>
        {loadError && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>We couldn&apos;t load your recent threads. {loadError}</span>
          </div>
        )}
      </div>

      <div className="shrink-0">
        <Composer
          prefill={pendingPrefill}
          onMessageSent={() => {
            if (pendingPrefill) clearPendingDeal()
          }}
        />
      </div>

      <div className="shrink-0 py-2">
        <Link
          href="/library"
          className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Browse the Library
        </Link>
      </div>

      {threads.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Recent deals</h2>
          <ul aria-label="Recent deals" className="space-y-0.5">
            {threads.map((t) => {
              const state = statusLabel(t.status)
              return (
                <li key={t.id}>
                  <Link
                    href={`/chat/${t.id}`}
                    className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
                  >
                    <span className="min-w-0 truncate font-medium">{t.title || "Untitled"}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {state && (
                        <span className="rounded-full border border-border/60 bg-muted/50 px-1.5 py-px text-[10px] font-medium">
                          {state}
                        </span>
                      )}
                      {formatDate(t.updatedAt)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
