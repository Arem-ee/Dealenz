"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Inbox, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getInboxStatus, importInboxThread, listInboxThreads, type InboxThreadItem } from "@/lib/gmail/actions"

// Inbox import panel: the user's own recent threads, imported as new deals
// on explicit per-thread action. No bulk import, no filters hiding mail —
// the ten most recent threads, picked by hand. Unconnected users get the
// connect step, not a dead end.
export function InboxPanel() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "unconnected" | "ready" | "error">("loading")
  const [threads, setThreads] = useState<InboxThreadItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
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
  }, [])

  async function handleImport(threadId: string) {
    if (importing) return
    setImporting(threadId)
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
      setImporting(null)
    }
  }

  if (status === "loading") {
    return (
      <div className="space-y-2" aria-label="Loading inbox">
        <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
      </div>
    )
  }

  if (status === "unconnected") {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <Inbox className="mx-auto h-6 w-6 text-muted-foreground/60" />
        <p className="mt-2 text-sm font-medium">Import deal threads from Gmail</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Connect Gmail once in Settings — Dealenz lists your recent threads here and imports the ones you pick as new deals.
        </p>
        <a
          href="/settings"
          className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Go to Settings
        </a>
      </div>
    )
  }

  if (status === "error") {
    return (
      <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
        {error ?? "Could not reach Gmail."}
      </p>
    )
  }

  if (threads.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
        No recent threads found in your inbox.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {threads.map((t) => (
        <li key={t.threadId} className="rounded-xl border bg-card p-4">
          <p className="truncate text-sm font-medium">{t.subject ?? "(no subject)"}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[t.from, t.date ? new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null].filter(Boolean).join(" · ") || "Unknown sender"}
          </p>
          {t.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.snippet}</p>}
          {importError[t.threadId] && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {importError[t.threadId]}
            </p>
          )}
          <Button size="sm" className="mt-3" disabled={importing !== null} onClick={() => void handleImport(t.threadId)}>
            {importing === t.threadId ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            {importing === t.threadId ? "Importing…" : "Import as new deal"}
          </Button>
        </li>
      ))}
    </ul>
  )
}
