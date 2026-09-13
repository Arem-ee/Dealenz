"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, Send } from "lucide-react"
import { AiWorking } from "@/components/ui/ai-working"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  askQuestionAction,
  getAskConversation,
  type AuditOption,
  type ConversationSummary,
} from "@/app/ask/actions"
import { classifyOperation, isGreeting } from "@/lib/conversation/classify"
import { priceForOperation } from "@/lib/credits/pricing"
import type { ConversationResponse, HistoryTurn } from "@/lib/conversation/request"
import type { Evidence } from "@/lib/evidence/schema"
import { EvidenceLine } from "@/components/evidence/evidence-line"
import { LegalCitationLine } from "@/components/evidence/legal-citation-line"
import { DocumentViewerModal } from "@/components/evidence/document-viewer"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  auditId?: string | null
  findings?: Array<{ ruleKey: string; summary: string; severity: string; guidance?: string; evidence?: Evidence[] }>
  sources?: Array<{ itemKey: string; title: string; authority: string; sourceName: string; sourceReference: string; jurisdiction: string; effectiveFrom: string }>
  legalCitations?: Array<{ title: string; section: string; url: string | null; passage: string; jurisdiction: string; authorityTier: number; retrievedAt: string; effectiveStatus: string }>
  researchState?: string | null
  legalLimitations?: string | null
  requiresLawyerReview?: boolean
  usageLine?: string | null
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

function estimatedCost(text: string, hasDocument: boolean): number | null {
  if (!text.trim()) return null
  if (isGreeting(text)) return 0
  try {
    return priceForOperation(classifyOperation(text, hasDocument))
  } catch {
    return null
  }
}

export function AskClient({
  initialBalance,
  audits,
  initialConversations,
  initialConversationId,
  initialAuditId = null,
}: {
  initialBalance: number | null
  audits: AuditOption[]
  initialConversations: ConversationSummary[]
  initialConversationId: string | null
  initialAuditId?: string | null
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations)
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [auditId, setAuditId] = useState<string>(initialAuditId ?? "")
  const [balance, setBalance] = useState<number | null>(initialBalance)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ auditId: string; evidence: Evidence } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  useEffect(() => {
    if (!selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing messages when conversation is deselected is intentional
      setMessages([])
      return
    }
    let cancelled = false
    getAskConversation(selectedId)
      .then((result) => {
        if (cancelled) return
        setAuditId(result.conversation.attachedAuditId ?? "")
        setMessages(
          result.messages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.content,
            auditId: result.conversation.attachedAuditId ?? null,
          }))
        )
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load conversation")
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  function toHistory(msgs: ChatMessage[]): HistoryTurn[] {
    return msgs.slice(-20).map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }))
  }

  function assistantMessage(
    response: Extract<ConversationResponse, { type: "answer" }>,
    attachedAuditId: string | null
  ): ChatMessage {
    const usageLine =
      response.creditsConsumed === null || response.creditsConsumed === undefined
        ? null
        : `${response.creditsConsumed} credit${response.creditsConsumed === 1 ? "" : "s"} used` +
          (response.balance !== null && response.balance !== undefined ? ` — ${response.balance} remaining` : "")
    return {
      id: newId(),
      role: "assistant",
      text: response.text,
      auditId: attachedAuditId,
      findings: response.findingsUsed.map((f) => ({
        ruleKey: f.ruleKey,
        summary: f.summary,
        severity: f.severity,
        guidance: f.guidance,
        evidence: f.evidence,
      })),
      sources: response.knowledgeSources,
      legalCitations: (response as unknown as { legalCitations?: ChatMessage["legalCitations"] }).legalCitations ?? [],
      researchState: (response as unknown as { researchState?: string | null }).researchState ?? null,
      legalLimitations: (response as unknown as { legalLimitations?: string | null }).legalLimitations ?? null,
      requiresLawyerReview: (response as unknown as { requiresLawyerReview?: boolean }).requiresLawyerReview ?? false,
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
    // Same intentional pacing as deal analysis: never flash working→done.
    const startedAt = Date.now()
    try {
      const response = await askQuestionAction({
        text: question,
        auditId: auditId || undefined,
        conversationId: selectedId ?? undefined,
        history: toHistory(nextMessages.slice(0, -1)),
        idempotencyKey: userMessage.id,
      })
      const newConversationId = (response as { conversationId?: string }).conversationId as string | undefined
      if (newConversationId && newConversationId !== selectedId) {
        setSelectedId(newConversationId)
        setConversations((prev) => {
          if (prev.some((c) => c.id === newConversationId)) return prev
          const title = question.slice(0, 60)
          return [{ id: newConversationId, title, attachedAuditId: auditId || null, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() }, ...prev]
        })
      }
      if (response.type === "answer") {
        const assistant = assistantMessage(response, auditId || null)
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
      const elapsed = Date.now() - startedAt
      if (elapsed < 900) await new Promise((r) => setTimeout(r, 900 - elapsed))
      setSending(false)
    }
  }

  const estimate = estimatedCost(input, Boolean(auditId))

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-5xl gap-4 px-4 py-4 sm:px-6">
      <aside className="hidden w-56 shrink-0 flex-col rounded-xl border border-border/60 bg-card p-3 shadow-sm md:flex">
        <Button
          variant="outline"
          size="sm"
          className="mb-3 w-full"
          onClick={() => {
            setSelectedId(null)
            setMessages([])
            setAuditId("")
            setError(null)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New conversation
        </Button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {conversations.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No conversations yet</p>}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={cn(
                "w-full truncate rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                selectedId === c.id && "bg-muted font-medium"
              )}
            >
              {c.title}
            </button>
          ))}
        </div>
        <p className="mt-3 truncate text-xs text-muted-foreground">
          Balance: {balance === null ? "…" : `${balance} credit${balance === 1 ? "" : "s"}`}
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
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
                        {f.evidence?.slice(0, 2).map((evidence) => (
                          <div key={evidence.id} className="mt-1 space-y-0.5">
                            <EvidenceLine evidence={evidence} />
                            {m.auditId && evidence.inspectable && evidence.sourceType !== "knowledge" ? (
                              <button
                                type="button"
                                onClick={() => setViewer({ auditId: m.auditId as string, evidence })}
                                className="text-[11px] font-medium text-primary hover:underline"
                              >
                                Inspect source
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                    <p className="font-medium">Sources</p>
                    {m.sources.map((s) => (
                      <p key={s.itemKey}>
                        {s.sourceName} — {s.authority.replaceAll("_", " ")} — {s.jurisdiction} — effective {s.effectiveFrom}
                      </p>
                    ))}
                  </div>
                )}
                {m.legalCitations && m.legalCitations.length > 0 && (
                  <div className="mt-2 border-t border-border/60 pt-2 text-xs">
                    <p className="font-medium text-foreground">Legal sources — {m.researchState ?? "VERIFIED"}</p>
                    {m.legalCitations.slice(0, 3).map((c) => (
                      <div key={`${c.title}-${c.section}`} className="mt-1 text-xs">
                        <LegalCitationLine citation={c} />
                      </div>
                    ))}
                    {m.legalLimitations && <p className="mt-1 text-muted-foreground">{m.legalLimitations}</p>}
                    {m.requiresLawyerReview && <p className="mt-1 font-medium text-warning-foreground">Consider getting a lawyer to confirm this applies to your facts.</p>}
                  </div>
                )}
                {m.researchState && (!m.legalCitations || m.legalCitations.length === 0) && (
                  <div className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                    <p>
                      Legal research: {m.researchState}
                      {m.legalLimitations ? ` — ${m.legalLimitations}` : ""}
                    </p>
                    {m.requiresLawyerReview && <p className="mt-1 font-medium text-warning-foreground">Consider getting a lawyer to confirm.</p>}
                  </div>
                )}
                {m.usageLine && <p className="mt-2 text-[11px] text-muted-foreground">{m.usageLine}</p>}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-muted/70 px-3.5 py-2.5">
                <AiWorking label="Thinking it through" />
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
          {estimate !== null ? (
            estimate === 0 ? (
              "No credits needed for greetings."
            ) : (
              <>Estimated cost: {estimate} credit{estimate === 1 ? "" : "s"}. </>
            )
          ) : null}
          Answers cost credits by operation size. <Link href="/billing" className="underline">Billing</Link>
        </p>
        {viewer ? (
          <DocumentViewerModal
            auditId={viewer.auditId}
            evidence={viewer.evidence}
            onClose={() => setViewer(null)}
          />
        ) : null}
      </div>
    </div>
  )
}
