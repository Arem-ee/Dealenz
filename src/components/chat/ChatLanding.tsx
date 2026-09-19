"use client"

import Link from "next/link"
import { FileText, MessageCircle, Clock, ArrowRight, AlertTriangle } from "lucide-react"
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

export function ChatLanding({ threads, loadError }: { threads: ThreadItem[]; loadError?: string | null }) {
  const hasThreads = threads.length > 0

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

      {/* Recent threads live in the sidebar on desktop; this list is the
          mobile equivalent (no sidebar below md). */}
      <section aria-label="Recent threads" className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-card/50 p-2 sm:p-3 md:hidden">
        <h2 className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent threads</h2>
        {hasThreads ? (
          <div className="space-y-2">
            {threads.map((t) => (
              <Link
                key={t.id}
                href={`/chat/${t.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40 group"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {t.auditId ? <FileText className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium group-hover:text-foreground">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">{formatDate(t.updatedAt)}</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  {formatDate(t.updatedAt)}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        ) : (
          !loadError && (
            <div className="rounded-xl border border-dashed bg-card px-6 py-8 text-center">
              <p className="text-sm font-medium">No threads yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Your recent conversations will appear here. Start by typing below.</p>
            </div>
          )
        )}
      </section>
      {/* Desktop spacer: the thread list lives in the sidebar at md+, so this
          keeps the composer pinned to the bottom with room to spare. */}
      <div className="hidden min-h-0 flex-1 flex-col items-center justify-center text-center md:flex">
        {!hasThreads && !loadError && (
          <p className="text-sm text-muted-foreground">
            Start a conversation below — your threads will appear in the sidebar.
          </p>
        )}
      </div>

      <div className="shrink-0 py-3 sm:py-4">
        <Composer />
      </div>
    </div>
  )
}
