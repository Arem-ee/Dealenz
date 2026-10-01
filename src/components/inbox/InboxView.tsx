"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, Clock, Inbox, Loader2, MailCheck, Undo2 } from "lucide-react"
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
import { deleteDeal } from "@/app/audit/[id]/actions"

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

const DONE_KEY = "dealenz.inbox.done"
const SNOOZED_KEY = "dealenz.inbox.snoozed"

function readIdSet(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((v): v is string => typeof v === "string"))
  } catch {
    return new Set()
  }
}

function writeIdSet(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids].slice(0, 200)))
  } catch {
    // Private mode: triage simply does not persist.
  }
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
  onDone,
  onSnooze,
  snoozed,
  selected,
  onSelect,
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
  onDone: () => void
  onSnooze: () => void
  snoozed: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li className={cn("overflow-hidden rounded-2xl border border-border bg-card", selected && "ring-2 ring-primary/50")}>
      <button
        type="button"
        onClick={() => { onSelect(); onToggle() }}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        {thread.unread && (
          <span aria-label="Unread" title="Unread" className="h-2 w-2 shrink-0 rounded-full bg-foreground" />
        )}
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm", thread.unread ? "font-semibold" : "font-medium")}>{thread.subject ?? "(no subject)"}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {[thread.from, formatDate(thread.date)].filter(Boolean).join(" · ") || "Unknown sender"}
          </span>
          {thread.snippet && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground/70">{thread.snippet}</span>
          )}
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={importing} onClick={onImport}>
                {importing && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {importing ? "Importing…" : "Import as new deal"}
              </Button>
              <Button size="sm" variant="outline" onClick={onDone} aria-label={snoozed ? "Move back to inbox" : "Mark done"}>
                <Check className="mr-1.5 h-3.5 w-3.5" /> Done
              </Button>
              <Button size="sm" variant="outline" onClick={onSnooze} aria-label={snoozed ? "Move back to inbox" : "Snooze for later"}>
                <Clock className="mr-1.5 h-3.5 w-3.5" /> {snoozed ? "Un-snooze" : "Snooze"}
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

interface ImportedBanner {
  threadId: string
  auditId: string
  title: string
}

export function InboxView() {
  const [status, setStatus] = useState<"loading" | "unconnected" | "ready" | "error">("loading")
  const [threads, setThreads] = useState<InboxThreadItem[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [messagesCache, setMessagesCache] = useState<Record<string, InboxMessageItem[]>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [messagesError, setMessagesError] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState<Set<string>>(new Set())
  const [importError, setImportError] = useState<Record<string, string>>({})
  const [imported, setImported] = useState<ImportedBanner | null>(null)
  const [undoing, setUndoing] = useState(false)
  const [zeroSnapshot, setZeroSnapshot] = useState<string[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState(false)
  const [doneIds, setDoneIds] = useState<Set<string>>(() => readIdSet(DONE_KEY))
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(() => readIdSet(SNOOZED_KEY))

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
          setNextPageToken(list.nextPageToken)
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

  async function handleLoadMore() {
    if (!nextPageToken || loadingMore) return
    setLoadingMore(true)
    try {
      const list = await listInboxThreads({ pageToken: nextPageToken })
      if (!list.ok) {
        setError(list.error)
        return
      }
      if (!list.connected) {
        setStatus("unconnected")
        return
      }
      setThreads((prev) => {
        const seen = new Set(prev.map((t) => t.threadId))
        return [...prev, ...list.threads.filter((t) => !seen.has(t.threadId))]
      })
      setNextPageToken(list.nextPageToken)
    } catch {
      setError("Could not load more threads.")
    } finally {
      setLoadingMore(false)
    }
  }

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

  async function handleImport(thread: InboxThreadItem) {
    const threadId = thread.threadId
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
      setImported({ threadId: res.threadId, auditId: res.auditId, title: thread.subject ?? "Imported email" })
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

  async function handleUndoImport() {
    if (!imported || undoing) return
    setUndoing(true)
    try {
      const res = await deleteDeal(imported.auditId)
      if (!res.ok) {
        setImportError({ [imported.threadId]: res.error })
        return
      }
      setImported(null)
    } finally {
      setUndoing(false)
    }
  }

  function markDone(threadId: string) {
    setDoneIds((prev) => {
      const next = new Set(prev)
      if (next.has(threadId)) next.delete(threadId)
      else next.add(threadId)
      writeIdSet(DONE_KEY, next)
      return next
    })
    setSnoozedIds((prev) => {
      if (!prev.has(threadId)) return prev
      const next = new Set(prev)
      next.delete(threadId)
      writeIdSet(SNOOZED_KEY, next)
      return next
    })
  }

  function toggleSnooze(threadId: string) {
    setSnoozedIds((prev) => {
      const next = new Set(prev)
      if (next.has(threadId)) next.delete(threadId)
      else next.add(threadId)
      writeIdSet(SNOOZED_KEY, next)
      return next
    })
  }

  const triageQuery = query.trim().toLowerCase()
  const triageMatches = (t: InboxThreadItem) =>
    !triageQuery || `${t.subject ?? ""} ${t.from ?? ""} ${t.snippet ?? ""}`.toLowerCase().includes(triageQuery)
  const main = threads.filter((t) => !doneIds.has(t.threadId) && !snoozedIds.has(t.threadId) && triageMatches(t))
  const later = threads.filter((t) => !doneIds.has(t.threadId) && snoozedIds.has(t.threadId) && triageMatches(t))

  function stepSelection(ids: string[], delta: 1 | -1) {
    if (ids.length === 0) return
    const idx = ids.indexOf(selectedId ?? "")
    const next = idx < 0 ? (delta === 1 ? ids[0]! : ids[ids.length - 1]!) : ids[(idx + delta + ids.length) % ids.length]!
    setSelectedId(next)
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return
      const ids = main.map((t) => t.threadId)
      if (status !== "ready" || ids.length === 0) {
        if (e.key === "?") setShowKeys((v) => !v)
        return
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault()
        stepSelection(ids, 1)
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault()
        stepSelection(ids, -1)
      } else if (e.key === "Enter") {
        const id = selectedId ?? ids[0]!
        setSelectedId(id)
        void handleToggle(id)
      } else if (e.key === "e") {
        const id = selectedId ?? ids[0]!
        markDone(id)
        const rest = ids.filter((x) => x !== id)
        setSelectedId(rest.length > 0 ? rest[Math.min(ids.indexOf(id), rest.length - 1)]! : null)
      } else if (e.key === "s") {
        const id = selectedId ?? ids[0]!
        toggleSnooze(id)
        const rest = ids.filter((x) => x !== id)
        setSelectedId(rest.length > 0 ? rest[Math.min(ids.indexOf(id), rest.length - 1)]! : null)
      } else if (e.key === "?") {
        setShowKeys((v) => !v)
      } else if (e.key === "Escape") {
        setShowKeys(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

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
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
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
        <Button size="sm" variant="outline" className="mt-2" onClick={() => { setThreads([]); setNextPageToken(undefined); setStatus("loading"); setError(null); setReloadKey((k) => k + 1) }}>
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

  function rowProps(t: InboxThreadItem) {
    return {
      thread: t,
      expanded: expandedId === t.threadId,
      messages: messagesCache[t.threadId] ?? null,
      loadingMessages: loadingId === t.threadId,
      messagesError: messagesError[t.threadId] ?? null,
      importing: importing.has(t.threadId),
      importError: importError[t.threadId] ?? null,
      onToggle: () => void handleToggle(t.threadId),
      onImport: () => void handleImport(t),
      onDone: () => markDone(t.threadId),
      onSnooze: () => toggleSnooze(t.threadId),
      snoozed: snoozedIds.has(t.threadId),
      selected: selectedId === t.threadId,
      onSelect: () => setSelectedId(t.threadId),
    }
  }

  function handleZero() {
    const ids = main.map((t) => t.threadId)
    if (ids.length === 0) return
    setZeroSnapshot(ids)
    setDoneIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      writeIdSet(DONE_KEY, next)
      return next
    })
    setSelectedId(null)
  }

  function undoZero() {
    if (!zeroSnapshot) return
    const gone = new Set(zeroSnapshot)
    setDoneIds((prev) => {
      const next = new Set([...prev].filter((id) => !gone.has(id)))
      writeIdSet(DONE_KEY, next)
      return next
    })
    setZeroSnapshot(null)
  }

  return (
    <div className="space-y-4">
      {imported && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <p className="min-w-0 flex-1 text-xs">
            <span className="font-semibold">Imported as deal.</span>{" "}
            <span className="text-muted-foreground">{imported.title}</span>
          </p>
          <Link
            href={`/chat/${imported.threadId}`}
            className="inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            View
          </Link>
          <button
            type="button"
            onClick={() => void handleUndoImport()}
            disabled={undoing}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3.5 text-xs font-medium hover:bg-muted/60 disabled:opacity-50"
          >
            <Undo2 className="h-3.5 w-3.5" /> {undoing ? "Undoing…" : "Undo"}
          </button>
          <button
            type="button"
            onClick={() => setImported(null)}
            aria-label="Dismiss import confirmation"
            className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}
      {zeroSnapshot && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <p className="min-w-0 flex-1 text-xs">
            <span className="font-semibold">{zeroSnapshot.length} threads archived.</span>{" "}
            <span className="text-muted-foreground">Nothing is deleted.</span>
          </p>
          <button
            type="button"
            onClick={undoZero}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3.5 text-xs font-medium hover:bg-muted/60"
          >
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
          <button
            type="button"
            onClick={() => setZeroSnapshot(null)}
            aria-label="Dismiss archive confirmation"
            className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subject, sender, or snippet…"
          aria-label="Search inbox"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        {main.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleZero} title="Archive all visible threads">
            Zero
          </Button>
        )}
        <button
          type="button"
          onClick={() => setShowKeys((v) => !v)}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          ?
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground" aria-live="polite">
        Showing {main.length + later.length} of {threads.length} threads{doneIds.size > 0 ? ` · ${doneIds.size} marked done` : ""} · triage keys: j/k move, Enter open, e done, s snooze.
      </p>
      {main.length === 0 && later.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {query.trim() ? "No threads match." : "Inbox triaged. Snoozed threads land below."}
        </p>
      ) : (
        <ul className="space-y-2">
          {main.map((t) => (
            <ThreadRow key={t.threadId} {...rowProps(t)} />
          ))}
        </ul>
      )}
      {nextPageToken && (
        <div className="text-center">
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void handleLoadMore()}>
            {loadingMore && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
      {later.length > 0 && (
        <section aria-label="Snoozed for later">
          <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Later · {later.length}
          </p>
          <ul className="space-y-2">
            {later.map((t) => (
              <ThreadRow key={t.threadId} {...rowProps(t)} />
            ))}
          </ul>
        </section>
      )}
      {doneIds.size > 0 && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              const next = new Set<string>()
              writeIdSet(DONE_KEY, next)
              setDoneIds(next)
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear {doneIds.size} done
          </button>
        </div>
      )}
      {showKeys && (
        <div aria-label="Keyboard shortcuts" className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Keyboard triage</p>
            <button
              type="button"
              onClick={() => setShowKeys(false)}
              aria-label="Close shortcuts"
              className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li><span className="font-mono font-semibold text-foreground">j / k</span> — move down / up</li>
            <li><span className="font-mono font-semibold text-foreground">Enter</span> — open thread</li>
            <li><span className="font-mono font-semibold text-foreground">e</span> — mark done, move on</li>
            <li><span className="font-mono font-semibold text-foreground">s</span> — snooze to Later, move on</li>
            <li><span className="font-mono font-semibold text-foreground">?</span> — toggle this panel</li>
          </ul>
        </div>
      )}
    </div>
  )
}
