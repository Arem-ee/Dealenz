"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { askQuestionAction, type AuditOption } from "@/app/ask/actions"
import type { ConversationResponse, HistoryTurn } from "@/lib/conversation/request"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  findings?: Array<{ ruleKey: string; summary: string; severity: string; guidance?: string }>
  sources?: Array<{ itemKey: string; title: string; authority: string; sourceName: string; sourceReference: string; jurisdiction: string; effectiveFrom: string }>
  usageLine?: string | null
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

export function AskClient({ initialBalance, audits }: { initialBalance: number | null; audits: AuditOption[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [auditId, setAuditId] = useState<string>("")
  const [balance, setBalance] = useState<number | null>(initialBalance)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  function toHistory(msgs: ChatMessage[]): HistoryTurn[] {
    return msgs.slice(-20).map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }))
  }

  function assistantMessage(response: Extract<ConversationResponse, { type: "answer" }>): ChatMessage {
    const usageLine =
      response.creditsConsumed === null || response.creditsConsumed === undefined
        ? null
        : `${response.creditsConsumed} credit${response.creditsConsumed === 1 ? "" : "s"} used` +
          (response.balance !== null && response.balance !== undefined ? ` · ${response.balance} remaining` : "")
    return {
      id: newId(),
      role: "assistant",
      text: response.text,
      findings: response.findingsUsed.map((f) => ({
        ruleKey: f.ruleKey,
        summary: f.summary,
        severity: f.severity,
        guidance: f.guidance,
      })),
      sources: response.knowledgeSources,
      usageLine,
    }
  }

  async function handleSend() {
    const question = input.trim()
    if (!question || sending) return
    setError(null)
    const userMessage: ChatMessage = { id: newId(), role: "user", text: question }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput("")
    setSending(true)
    try {
      const response = await askQuestionAction({
        text: question,
        auditId: auditId || undefined,
        history: toHistory(nextMessages.slice(0, -1)),
        idempotencyKey: userMessage.id,
      })
      if (response.type === "answer") {
        const assistant = assistantMessage(response)
        setMessages((prev) => [...prev, assistant])
        if (typeof response.balance === "number") setBalance(response.balance)
      } else if (response.type === "needs_document") {
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: response.message }])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            text: `I cannot run that right now: ${response.denialReason}. Credits pay for computation, and this one needs more than is available.`,
          },
        ])
        if (typeof response.balance === "number") setBalance(response.balance)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Ask Dealenz</h1>
          <p className="truncate text-sm text-muted-foreground">
            Questions with or without a document. Balanced at {balance === null ? "… " : `${balance} credit${balance === 1 ? "" : "s"}`}.
          </p>
        </div>
        <select
          value={auditId}
          onChange={(e) => setAuditId(e.target.value)}
          className="h-9 max-w-[220px] truncate rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Attach a deal (optional)"
        >
          <option value="">No document attached</option>
          {audits.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        {messages.length === 0 && (
          <div className="space-y-2 py-8 text-center">
            <p className="text-sm font-medium">Ask about any deal, with or without paperwork.</p>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-muted-foreground">
              Try &ldquo;What does net 30 mean?&rdquo;, &ldquo;Should I ask for a deposit before starting?&rdquo;, or attach a
              deal above and ask &ldquo;Should I accept this?&rdquo;
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/70 text-foreground"
              )}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.findings && m.findings.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                  {m.findings.map((f) => (
                    <div key={f.ruleKey} className="text-[13px]">
                      <p className="font-medium capitalize">{f.severity}: {f.summary}</p>
                      {f.guidance && <p className="text-muted-foreground">{f.guidance}</p>}
                    </div>
                  ))}
                </div>
              )}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  <p className="font-medium">Sources</p>
                  {m.sources.map((s) => (
                    <p key={s.itemKey}>
                      {s.sourceName} · {s.authority.replaceAll("_", " ")} · {s.jurisdiction} · effective {s.effectiveFrom}
                    </p>
                  ))}
                </div>
              )}
              {m.usageLine && <p className="mt-2 text-[11px] text-muted-foreground">{m.usageLine}</p>}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl bg-muted/70 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <button className="font-medium hover:underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder="Ask about a deal…"
          rows={2}
          className="min-h-[52px] resize-none"
          aria-label="Your question"
        />
        <Button onClick={() => void handleSend()} disabled={sending || !input.trim()} size="icon" aria-label="Send">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Answers cost credits by operation size. <Link href="/billing" className="underline">Billing</Link>
      </p>
    </div>
  )
}
