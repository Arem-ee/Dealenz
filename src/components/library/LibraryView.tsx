"use client"

import { useState } from "react"
import Link from "next/link"
import { Archive, ArrowUp, FileText, Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { vaultChatAction, type VaultMatch } from "@/app/vault/actions"
import {
  listStandingRules,
  addStandingRule,
  deleteStandingRule,
  type StandingRule,
} from "@/app/library/actions"
import { MAX_STANDING_RULES } from "@/lib/standing/rules"
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
  // Deep-linkable mode so entry points outside Library can land directly on
  // the Gmail import tab (e.g. /library?mode=inbox). Client-only read keeps
  // this SSR-safe without a Suspense boundary.
  const [mode, setMode] = useState<"search" | "inbox" | "rules">(() => {
    try {
      const m = new URLSearchParams(window.location.search).get("mode")
      if (m === "inbox" || m === "rules") return m
    } catch {
      // Non-browser render: fall through to default.
    }
    return "search"
  })
  const [rules, setRules] = useState<StandingRule[] | null>(null)
  const [rulesLoading, setRulesLoading] = useState(false)
  const [newRule, setNewRule] = useState("")
  const [savingRule, setSavingRule] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  async function refreshRules() {
    setRulesLoading(true)
    try {
      const res = await listStandingRules()
      if (!res.ok) {
        showError(res.error, "Rules failed to load")
        return
      }
      setRules(res.rules)
    } catch {
      showError("Rules failed to load")
    } finally {
      setRulesLoading(false)
    }
  }

  function switchMode(m: "search" | "inbox" | "rules") {
    setMode(m)
    if (m === "rules" && rules === null && !rulesLoading) void refreshRules()
  }

  async function handleAddRule() {
    const text = newRule.trim()
    if (!text || savingRule) return
    setSavingRule(true)
    try {
      const res = await addStandingRule(text)
      if (!res.ok) {
        showError(res.error, "Rule not saved")
        return
      }
      setNewRule("")
      setRules((prev) => (prev === null ? [res.rule] : [...prev, res.rule]))
    } catch {
      showError("Rule not saved")
    } finally {
      setSavingRule(false)
    }
  }

  async function handleDeleteRule(id: string) {
    if (deletingId) return
    setDeletingId(id)
    try {
      const res = await deleteStandingRule(id)
      if (!res.ok) {
        showError(res.error, "Rule not deleted")
        return
      }
      setRules((prev) => (prev ?? []).filter((r) => r.id !== id))
    } catch {
      showError("Rule not deleted")
    } finally {
      setDeletingId(null)
    }
  }

  const MODES = [
    { key: "search" as const, label: "Search deals", desc: "Find any deal in plain words" },
    { key: "inbox" as const, label: "From inbox", desc: "Import threads from Gmail" },
    { key: "rules" as const, label: "Rules", desc: "Standing rules for every deal" },
  ]

  const conversation = (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Mobile: compact top tabs. Desktop: the library reads as a library —
          its own sub-sidebar, not pills floating over content. */}
      <div className="shrink-0 border-b border-border/60 px-4 py-2 md:hidden">
        <div className="mx-auto flex w-full max-w-2xl gap-1" role="tablist" aria-label="Library mode">
          {MODES.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => switchMode(m.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                mode === m.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <aside className="hidden w-60 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border/60 p-3 md:flex" aria-label="Library">
        <p className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Library
        </p>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => switchMode(m.key)}
            aria-current={mode === m.key ? "page" : undefined}
            className={cn(
              "rounded-xl px-4 py-2.5 text-left transition-colors",
              mode === m.key
                ? "bg-burgundy/10 text-burgundy"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <span className={cn("block text-sm", mode === m.key && "font-semibold")}>{m.label}</span>
            <span className="mt-0.5 block text-[11px] opacity-70">{m.desc}</span>
          </button>
        ))}
      </aside>
      <div className="flex min-h-0 flex-1 flex-col">
      {mode === "inbox" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-2xl">
            <InboxPanel />
          </div>
        </div>
      ) : mode === "rules" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-2xl space-y-3">
            <div>
              <p className="text-sm font-semibold">Standing rules</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Write once, applied to every deal. Dealenz weighs these in every answer and analysis.
              </p>
            </div>
            {rulesLoading && rules === null ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Loading your rules…</p>
            ) : (
              <>
                {(rules ?? []).length === 0 ? (
                  <div className="rounded-xl border bg-card p-6 text-center">
                    <p className="text-sm font-medium">No rules yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try “I never accept net-60” or “Always flag uncapped liability”.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {(rules ?? []).map((r) => (
                      <li key={r.id} className="flex items-start gap-2 rounded-xl border bg-card px-4 py-3">
                        <p className="min-w-0 flex-1 text-sm leading-relaxed">{r.text}</p>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRule(r.id)}
                          disabled={deletingId === r.id}
                          aria-label={`Delete rule: ${r.text.slice(0, 60)}`}
                          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
                  {(rules ?? []).length} of {MAX_STANDING_RULES} rules
                </p>
                <div className="flex items-end gap-2">
                  <label htmlFor="library-rule-input" className="sr-only">New standing rule</label>
                  <input
                    id="library-rule-input"
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void handleAddRule()
                      }
                    }}
                    placeholder="e.g. I never accept net-60"
                    maxLength={300}
                    className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                  <Button
                    size="icon"
                    onClick={() => void handleAddRule()}
                    disabled={savingRule || !newRule.trim()}
                    aria-label={savingRule ? "Saving rule" : "Add rule"}
                    className="h-11 w-11 shrink-0 rounded-full"
                  >
                    {savingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            )}
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
    </div>
  )

  // Single column on every viewport: the conversation carries inline
  // result cards, so there is nothing for a second panel to show.
  return <div className="flex h-full min-h-0 flex-col">{conversation}</div>
}
