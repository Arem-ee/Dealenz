"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { askSharedQuestion, postSharedComment } from "@/app/(app)/chat/actions"

// Shared writer: ask and/or comment boxes for group members, per scope.
// Owners never see this (they keep the full composer); viewers see
// nothing writable. Errors surface inline; success refreshes the thread.
export function SharedComposer({ threadId, scope }: {
  threadId: string
  scope: "commenter" | "asker" | "participant"
}) {
  const router = useRouter()
  const [tab, setTab] = useState<"ask" | "comment">(
    scope === "commenter" ? "comment" : "ask"
  )
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAsk = scope === "asker" || scope === "participant"
  const canComment = scope === "commenter" || scope === "participant"

  async function send() {
    if (busy || !text.trim()) return
    if (tab === "ask" && !canAsk) return
    if (tab === "comment" && !canComment) return
    setBusy(true)
    setError(null)
    try {
      const res = tab === "ask"
        ? await askSharedQuestion({ threadId, text: text.trim() })
        : await postSharedComment({ threadId, text: text.trim() })
      if (!res.ok) throw new Error(res.error)
      setText("")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-x-3 bottom-3 border border-border bg-background px-3 py-2">
      {canAsk && canComment && (
        <div className="mb-1.5 flex gap-1.5" role="tablist" aria-label="Shared write mode">
          {(["ask", "comment"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              disabled={busy}
              className={`px-2 py-0.5 text-[11px] font-medium capitalize transition-colors disabled:opacity-50 ${
                tab === t ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "ask" ? "Ask" : "Comment"}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mb-1.5 border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          disabled={busy}
          aria-label={tab === "ask" ? "Ask about the shared deal" : "Comment on the shared deal"}
          placeholder={tab === "ask" ? "Ask about this deal" : "Comment for the owner"}
          autoComplete="off"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !text.trim()}
          aria-label="Send"
          className="flex h-8 shrink-0 items-center bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          Send
        </button>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {tab === "ask" ? "Questions are rate-limited like everyone else's." : "Comments post with no AI — the owner is notified."}
      </p>
    </div>
  )
}
