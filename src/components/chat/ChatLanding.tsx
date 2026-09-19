"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Composer } from "./Composer"

interface ThreadItem {
  id: string
  title: string
  auditId: string | null
  updatedAt: string
}

function formatDate(date: string): string {
  const d = new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * Composer-first Home: heading, composer, one understated Library link, then
 * recent activity (title + relative time, straight into each thread). No
 * action cards, no tours, no tooltips — the classifier routes whatever is
 * typed, and the UI stays out of its way.
 */
export function ChatLanding({ threads, loadError }: { threads: ThreadItem[]; loadError?: string | null }) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-4">
      <div className="shrink-0 pb-3 pt-4 sm:pt-5">
        <h1 className="text-xl font-semibold tracking-tight">How can I help?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask a question, paste a contract, or drop a file. I will route it correctly — no extra steps.</p>
        {loadError && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>We couldn&apos;t load your recent threads. {loadError}</span>
          </div>
        )}
      </div>

      <div className="shrink-0">
        <Composer />
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
        <ul aria-label="Recent activity" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-4">
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                href={`/chat/${t.id}`}
                className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0 truncate font-medium">{t.title || "Untitled"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(t.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
