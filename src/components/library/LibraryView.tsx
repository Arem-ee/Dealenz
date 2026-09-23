"use client"

import { useState } from "react"
import Link from "next/link"
import { Archive, ArrowUp, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { vaultChatAction, type VaultMatch } from "@/app/vault/actions"
import { InboxPanel } from "./inbox-panel"
import { cn } from "@/lib/utils"
import { Markdown } from "@/components/chat/Markdown"

interface LibraryTurn {
  id: string
  question: string
  answer: string
  matches: VaultMatch[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function ResultCard({ match }: { match: VaultMatch }) {
  return (
    <Link
      href={`/chat/${match.id}`}
      className="block rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{match.title}</p>
          <p className="mt-0.5 text-xs capitalize text-muted-foreground">
            {(match.dealType ?? "deal").replace("_", " ")} · {formatDate(match.updatedAt)}
            {typeof match.overallScore === "number" ? ` · ${match.overallScore}/100` : ""}
          </p>
          {match.topFinding ? (
            <p className="mt-1.5 line-clamp-2  text-[13px] leading-relaxed">{match.topFinding.summary}</p>
          ) : null}
        </div>
        {match.riskLevel ? (
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            {match.riskLevel}
          </span>
        ) : null}
      </div>
    </Link>
  )
}

export function LibraryView() {
  const { showError } = useToast()
  const [turns, setTurns] = useState<LibraryTurn[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [mode, setMode] = useState<"search" | "inbox">("search")

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const res = await vaultChatAction({ text })
      if (!res.ok) {
        showError(res.error, "Library search failed")
        return
      }
      setTurns((t) => [...t, { id: `${Date.now()}`, question: text, answer: res.content, matches: res.matches }])
      setInput("")
    } catch (err) {
      showError(err instanceof Error ? err.message : "Library search failed")
    } finally {
      setSending(false)
    }
  }

  const conversation = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/60 px-4 py-2">
        <div className="mx-auto flex w-full max-w-2xl gap-1" role="tablist" aria-label="Library mode">
          {(["search", "inbox"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                mode === m ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "search" ? "Search deals" : "From inbox"}
            </button>
          ))}
        </div>
      </div>
      {mode === "inbox" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-2xl">
            <InboxPanel />
          </div>
        </div>
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {turns.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-center">
              <Archive className="mx-auto h-6 w-6 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium">Search your deals in plain words</p>
              <p className="mt-1 text-xs text-muted-foreground">Try “which deals have an uncapped liability clause” or “show me recent deals”.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {["which deals have an uncapped liability clause", "show me recent deals"].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="rounded-full border bg-muted px-3 py-1 text-xs hover:bg-muted/80"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t) => (
            <div key={t.id} className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                  <Markdown text={t.question} />
                </div>
              </div>
              <div className="flex justify-start">
                <div className="w-full max-w-[95%] rounded-2xl bg-muted px-4 py-3 text-sm leading-relaxed">
                  <Markdown text={t.answer} />
                </div>
              </div>
              {/* Result cards always render inline under the answer: a second
                  panel showing the same matches is dead space, not structure. */}
              {t.matches.length > 0 && (
                <div className="space-y-2">
                  {t.matches.map((m) => (
                    <ResultCard key={m.id} match={m} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">Searching…</div>
            </div>
          )}
        </div>
      </div>
      )}
      {mode === "search" && (
      <div className="shrink-0 border-t border-border/60 bg-background p-4">
        <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
          <label htmlFor="library-input" className="sr-only">Search your deals</label>
          <textarea
            id="library-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder="Search your deals in plain words…"
            rows={2}
            className="min-h-[52px] w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <Button size="icon" onClick={() => void handleSend()} disabled={sending || !input.trim()} aria-label={sending ? "Searching" : "Search"} className="h-11 w-11 shrink-0 rounded-full">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      )}
    </div>
  )

  // Single column on every viewport: the conversation carries inline
  // result cards, so there is nothing for a second panel to show.
  return <div className="flex h-full min-h-0 flex-col">{conversation}</div>
}
