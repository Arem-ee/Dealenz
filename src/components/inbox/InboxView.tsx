"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Inbox, Loader2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getInboxStatus,
  getInboxThreadDetail,
  importInboxThread,
  listInboxThreads,
  type InboxMessageItem,
  type InboxThreadItem,
} from "@/lib/gmail/actions"

function formatDate(date: string | null): string {
  if (!date) return ""
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ""
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function ThreadRow({
  thread,
  expanded,
  messages,
  loadingMessages,
  messagesError,
  importing,
  importError,
  onToggle,
  onImport,
}: {
  thread: InboxThreadItem
  expanded: boolean
  messages: InboxMessageItem[] | null
  loadingMessages: boolean
  messagesError: string | null
  importing: boolean
  importError: string | null
  onToggle: () => void
  onImport: () => void
}) {
  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{thread.subject ?? "(no subject)"}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {[thread.from, formatDate(thread.date)].filter(Boolean).join(" · ") || "Unknown sender"}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="border-t border-border/60 px-4 py-3">
          {loadingMessages && (
            <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading thread…
            </p>
          )}
          {messagesError && (
            <p role="alert" className="py-1 text-xs text-destructive">{messagesError}</p>
          )}
          {messages && (
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className="rounded-xl bg-muted/40 px-3.5 py-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {[m.from, m.date ? formatDate(m.date) : null].filter(Boolean).join(" · ") || "Message"}
                  </p>
                  {m.subject && <p className="mt-0.5 text-xs font-semibold">{m.subject}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{m.bodyText ?? m.subject ?? "No readable text."}</p>
                </div>
              ))}
            </div>
          )}
          {!loadingMessages && (
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" disabled={importing} onClick={onImport}>
                {importing && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {importing ? "Importing…" : "Import as new deal"}
              </Button>
              {importError && (
                <p role="alert" className="text-xs text-destructive">{importError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

export function InboxView() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "unconnected" | "ready" | "error">("loading")
  const [threads, setThreads] = useState<InboxThreadItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [messagesCache, setMessagesCache] = useState<Record<string, InboxMessageItem[]>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [messagesError, setMessagesError] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState<Set<string>>(new Set())
  const [importError, setImportError] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    getInboxStatus()
      .then((res) => {
        if (cancelled) return
        if (!res.ok || !res.connected) {
          setStatus("unconnected")
          return
        }
        return listInboxThreads().then((list) => {
          if (cancelled) return
          if (!list.ok) {
            setError(list.error)
            setStatus("error")
            return
          }
          if (!list.connected) {
            setStatus("unconnected")
            return
          }
          setThreads(list.threads)
          setStatus("ready")
        })
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not reach Gmail.")
          setStatus("error")
        }
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function handleToggle(threadId: string) {
    if (expandedId === threadId) {
      setExpandedId(null)
      return
    }
    setExpandedId(threadId)
    if (messagesCache[threadId]) return
    setLoadingId(threadId)
    setMessagesError((s) => {
      const next = { ...s }
      delete next[threadId]
      return next
    })
    try {
      const res = await getInboxThreadDetail(threadId)
      if (!res.ok) {
        setMessagesError((s) => ({ ...s, [threadId]: res.error }))
        return
      }
      setMessagesCache((s) => ({ ...s, [threadId]: res.messages }))
    } catch {
      setMessagesError((s) => ({ ...s, [threadId]: "Could not read that thread. Please try again." }))
    } finally {
      setLoadingId((id) => (id === threadId ? null : id))
    }
  }

  async function handleImport(threadId: string) {
    if (importing.has(threadId)) return
    setImporting((prev) => new Set(prev).add(threadId))
    setImportError((s) => {
      const next = { ...s }
      delete next[threadId]
      return next
    })
    try {
      const res = await importInboxThread(threadId)
      if (!res.ok) {
        setImportError((s) => ({ ...s, [threadId]: res.error }))
        return
      }
      router.push(`/chat/${res.threadId}`)
    } catch {
      setImportError((s) => ({ ...s, [threadId]: "Could not import that thread. Please try again." }))
    } finally {
      setImporting((prev) => {
        const next = new Set(prev)
        next.delete(threadId)
        return next
      })
    }
  }

  if (status === "loading") {
    return (
      <div className="space-y-2" aria-label="Loading inbox">
        <div className="h-16 animate-pulse rounded-2xl bg-muted/60" />
        <div className="h-16 animate-pulse rounded-2xl bg-muted/60" />
        <div className="h-16 animate-pulse rounded-2xl bg-muted/60" />
      </div>
    )
  }

  if (status === "unconnected") {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-burgundy/10 text-burgundy">
          <MailCheck className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-semibold">See your deals where they arrive</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Connect Gmail once. Read threads here, then import the ones that matter as new deals —
          no more digging through Settings and tabs.
        </p>
        <a
          href="/api/gmail/auth"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Connect Gmail
        </a>
        <p className="mx-auto mt-3 max-w-sm text-[11px] leading-relaxed text-muted-foreground/70">
          Read-only listing until you import. Disconnect any time in Settings.
        </p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-xs text-destructive">{error ?? "Could not reach Gmail."}</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => { setStatus("loading"); setError(null); setReloadKey((k) => k + 1) }}>
          Retry
        </Button>
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed px-4 py-10 text-center">
        <Inbox className="mx-auto h-6 w-6 text-muted-foreground/60" />
        <p className="mt-2 text-sm font-medium">Inbox is clear</p>
        <p className="mt-1 text-xs text-muted-foreground">No recent threads found. New deal mail shows up here.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {threads.map((t) => (
        <ThreadRow
          key={t.threadId}
          thread={t}
          expanded={expandedId === t.threadId}
          messages={messagesCache[t.threadId] ?? null}
          loadingMessages={loadingId === t.threadId}
          messagesError={messagesError[t.threadId] ?? null}
          importing={importing.has(t.threadId)}
          importError={importError[t.threadId] ?? null}
          onToggle={() => void handleToggle(t.threadId)}
          onImport={() => void handleImport(t.threadId)}
        />
      ))}
    </ul>
  )
}
