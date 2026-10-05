"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Composer } from "@/components/workspace/composer"
import { DealValue } from "@/components/workspace/deal-value"
import { GenerateDraft } from "@/components/workspace/generate-draft"
import { ShareDialog } from "@/components/workspace/share-dialog"
import { SharedComposer } from "@/components/workspace/shared-composer"
import { deleteSharedMessage } from "@/app/(app)/chat/actions"
import { correctDealType, type ThreadView as ThreadData } from "@/app/(app)/chat/actions"
import { INTAKE_DEAL_TYPES } from "@/lib/deals/intake"

function typeLabel(t: string): string {
  return t === "purchase_sale" ? "Purchase/Sale" : t.charAt(0).toUpperCase() + t.slice(1)
}

function operationLabel(op: string | null): string {
  if (!op) return "review"
  return op.replace(/_/g, " ")
}

// Deal thread: the conversation so far, the classifier's visible shot with
// one-tap correction, and the composer appending material. Analysis runs
// land next; nothing here fabricates assistant turns.
export function ThreadView({ initial }: { initial: ThreadData }) {
  const router = useRouter()
  const [dealType, setDealType] = useState<string | null>(initial.dealType)
  const [correcting, setCorrecting] = useState(false)
  const [correctError, setCorrectError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const scope = initial.shared ? initial.scope : "owner"
  const canWriteShared = scope === "commenter" || scope === "asker" || scope === "participant"

  async function removeMessage(id: string) {
    if (deletingId) return
    setDeletingId(id)
    try {
      const res = await deleteSharedMessage({ messageId: id })
      if (!res.ok) throw new Error(res.error)
      router.refresh()
    } catch {
      // Silent; the row stays.
    } finally {
      setDeletingId(null)
    }
  }

  async function correct(next: string) {
    if (!initial.auditId || next === dealType || correcting) return
    setCorrecting(true)
    setCorrectError(null)
    try {
      const res = await correctDealType({ auditId: initial.auditId, dealType: next })
      if (!res.ok) throw new Error(res.error)
      setDealType(next)
      router.refresh()
    } catch (err) {
      setCorrectError(err instanceof Error ? err.message : "We couldn't save that.")
    } finally {
      setCorrecting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section aria-label="Conversation" className="relative flex min-h-0 min-w-0 flex-1 flex-col border-b border-border lg:border-b-0 lg:border-r">
        {initial.shared && (
          <p role="status" className="shrink-0 border-b border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
            {scope === "viewer" && "Shared with you — read-only. Only the owner can ask, edit, or sign here."}
            {scope === "commenter" && "Shared with you — you can comment. Only the owner can ask, edit, or sign."}
            {scope === "asker" && "Shared with you — you can ask questions. Only the owner can edit or sign."}
            {scope === "participant" && "Shared with you — you can ask and comment. Only the owner can edit or sign."}
          </p>
        )}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-24 pt-4">
          {initial.messages.map((m) => {
            const mine = m.userId === initial.currentUserId
            const sharedMark = (m.metadata as Record<string, unknown> | undefined)?.shared === true
            return (
            <div key={m.id} className={cn("max-w-[85%]", m.role === "user" ? "ml-auto" : "mr-auto")}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {m.role === "user" ? (mine ? "You" : "Member") : "Dealenz"}
                {sharedMark && m.role === "user" && !mine && <span className="ml-1 font-normal normal-case">· shared</span>}
              </p>
              <p className={cn(
                "mt-1 whitespace-pre-wrap px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {m.content}
              </p>
              {initial.auditId && !mine && sharedMark && scope === "owner" && (
                <button
                  type="button"
                  onClick={() => void removeMessage(m.id)}
                  disabled={deletingId !== null}
                  aria-label="Remove this comment"
                  className="mt-1 text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
            )
          })}
        </div>
        {initial.shared ? (
          canWriteShared && initial.auditId ? (
            <SharedComposer threadId={initial.threadId} scope={scope as "commenter" | "asker" | "participant"} />
          ) : null
        ) : (
          <Composer mode={initial.auditId ? { kind: "thread", threadId: initial.threadId, auditId: initial.auditId } : { kind: "new" }} />
        )}
      </section>
      <section aria-label="Work surface" className="hidden min-h-0 min-w-0 flex-[1.4] flex-col bg-muted/20 lg:flex">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="border border-border bg-background p-4" aria-label="Classifier routing">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Detected</p>
            <p className="mt-1 text-sm">
              Looks like <strong>{operationLabel(initial.operation)}</strong>
              {dealType ? <> · <strong>{typeLabel(dealType)}</strong></> : null} — correct it if wrong:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Correct deal type">
              {INTAKE_DEAL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => void correct(t)}
                  disabled={correcting || !initial.auditId || initial.shared}
                  aria-pressed={dealType === t}
                  className={cn(
                    "border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                    dealType === t
                      ? "border-foreground bg-muted font-semibold text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {typeLabel(t)}
                </button>
              ))}
            </div>
            {correctError && <p role="alert" className="mt-2 text-xs text-destructive">{correctError}</p>}
          </div>
          {initial.findings.length > 0 ? (
            <section aria-label="Findings" className="border border-border bg-background">
              <p className="border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Findings · {initial.findings.length}
              </p>
              <ul className="divide-y divide-border">
                {initial.findings.map((f) => (
                  <li key={f.ruleKey} className="px-4 py-3">
                    <p className="flex items-center gap-2 text-[13px] font-medium">
                      <span className={cn(
                        "border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                        f.severity === "critical"
                          ? "border-brick-700/40 bg-brick-700/10 text-brick-700"
                          : "border-border text-muted-foreground"
                      )}>
                        {f.severity}
                      </span>
                      {f.summary}
                    </p>
                    {f.guidance && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.guidance}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <p className="text-sm font-medium">Work appears here</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Analysis runs automatically — findings land in this panel.
              </p>
            </div>
          )}
          {initial.corpusConflicts.length > 0 && (
            <section aria-label="Cross-contract conflicts" className="border border-brick-700/40 bg-background">
              <p className="border-b border-brick-700/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-brick-700">
                Against your other deals · {initial.corpusConflicts.length}
              </p>
              <ul className="divide-y divide-border">
                {initial.corpusConflicts.map((c, i) => (
                  <li key={`${c.auditId}-${c.clauseTitle}-${i}`} className="px-4 py-3">
                    <p className="text-[13px] leading-relaxed">{c.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {c.auditTitle} — {c.clauseTitle}
                    </p>
                    {c.quote && (
                      <p className="mt-1 border-l-2 border-brick-700/40 pl-2 text-[11px] leading-relaxed text-muted-foreground">
                        “{c.quote}”
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {initial.auditId && <GenerateDraft auditId={initial.auditId} />}
          {initial.auditId && !initial.shared && (
            <DealValue auditId={initial.auditId} minor={initial.dealValueMinor} currency={initial.dealValueCurrency} />
          )}
          {initial.auditId && <ShareDialog auditId={initial.auditId} shared={initial.shared} />}
        </div>
      </section>
    </div>
  )
}
