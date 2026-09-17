"use client"

import Link from "next/link"
import { FileText, MessageCircle, Clock, ArrowRight } from "lucide-react"
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

export function ChatLanding({ threads }: { threads: ThreadItem[] }) {
  const hasThreads = threads.length > 0

  return (
    <div className="mx-auto max-w-3xl w-full px-4 py-6 sm:py-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">How can I help?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask a question, paste a contract, or drop a file. I will route it correctly — no extra steps.</p>
      </div>

      <Composer />

      {hasThreads ? (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Recent threads</h2>
          </div>
          <div className="space-y-2">
            {threads.map((t) => (
              <Link
                key={t.id}
                href={`/chat/${t.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/40 transition-colors group"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {t.auditId ? <FileText className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate group-hover:text-foreground">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">{formatDate(t.updatedAt)}</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  {formatDate(t.updatedAt)}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card px-6 py-8 text-center">
          <p className="text-sm font-medium">No threads yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Your recent conversations will appear here. Start by typing above.</p>
        </div>
      )}
    </div>
  )
}
