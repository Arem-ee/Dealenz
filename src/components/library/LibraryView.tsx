"use client"

import { useState } from "react"
import Link from "next/link"
import { Archive, ArrowUp, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SplitPane, useIsDesktop } from "@/components/split-pane"
import { useToast } from "@/components/ui/toast"
import { vaultChatAction, type VaultMatch } from "@/app/vault/actions"
import { InboxPanel } from "./inbox-panel"
import { cn } from "@/lib/utils"

interface LibraryTurn {
  id: string
  question: string
  answer: string
  matches: VaultMatch[]
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "border-destructive/30 bg-destructive/5 text-destructive",
  material: "border-amber-500/30 bg-amber-500/5 text-amber-700",
  attention: "border-blue-500/30 bg-blue-500/5 text-blue-700",
  informational: "border-border bg-muted/30 text-muted-foreground",
  low: "border-border bg-muted/30 text-muted-foreground",
  medium: "border-blue-500/30 bg-blue-500/5 text-blue-700",
  high: "border-amber-500/30 bg-amber-500/5 text-amber-700",
}

function severityClass(severity: string | null): string {
  if (!severity) return SEVERITY_STYLE.informational
  return SEVERITY_STYLE[severity.toLowerCase()] ?? SEVERITY_STYLE.informational
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
            <p className="mt-1.5 line-clamp-2 font-serif text-[13px] leading-relaxed">{match.topFinding.summary}</p>
          ) : null}
        </div>
        {match.riskLevel ? (
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", severityClass(match.riskLevel))}>
            {match.riskLevel}
          </span>
        ) : null}
      </div>
    </Link>
  )
}

function ResultsPanel({ matches, emptyHint }: { matches: VaultMatch[]; emptyHint: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/60 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">Results</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {matches.length === 0 ? "Ask about your deals to see matching results here." : `${matches.length} matching deal${matches.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {matches.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">{emptyHint}</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <ResultCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function LibraryView({ userId }: { userId: string }) {
  const isDesktop = useIsDesktop()
  const { showError } = useToast()
  const [turns, setTurns] = useState<LibraryTurn[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [mode, setMode] = useState<"search" | "inbox">("search")

  const latestMatches = turns.length > 0 ? turns[turns.length - 1].matches : []

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
                  <p className="whitespace-pre-wrap">{t.question}</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="w-full max-w-[95%] rounded-2xl bg-muted px-4 py-3 text-sm leading-relaxed">
                  <p className="whitespace-pre-wrap">{t.answer}</p>
                </div>
              </div>
              {/* Inline result cards: the mobile base. Hidden on desktop where the panel shows them. */}
              {!isDesktop && t.matches.length > 0 && (
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
          <Button size="icon" onClick={() => void handleSend()} disabled={sending || !input.trim()} aria-label={sending ? "Searching" : "Search"} className="h-9 w-9 shrink-0 rounded-full">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      )}
    </div>
  )

  // Mobile base: conversation with inline cards. Desktop layer: split conversation + results panel.
  if (!isDesktop) {
    return <div className="flex h-full min-h-0 flex-col">{conversation}</div>
  }

  return (
    <SplitPane
      userId={userId}
      paneKey="library"
      primary={conversation}
      panel={<ResultsPanel matches={latestMatches} emptyHint="Search on the left — results from your latest search appear here as structured cards." />}
    />
  )
}
