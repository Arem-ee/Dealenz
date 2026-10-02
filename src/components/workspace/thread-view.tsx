"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Composer } from "@/components/workspace/composer"
import { GenerateDraft } from "@/components/workspace/generate-draft"
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
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-24 pt-4">
          {initial.messages.map((m) => (
            <div key={m.id} className={cn("max-w-[85%]", m.role === "user" ? "ml-auto" : "mr-auto")}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {m.role === "user" ? "You" : "Dealenz"}
              </p>
              <p className={cn(
                "mt-1 whitespace-pre-wrap px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {m.content}
              </p>
            </div>
          ))}
        </div>
        <Composer mode={initial.auditId ? { kind: "thread", threadId: initial.threadId, auditId: initial.auditId } : { kind: "new" }} />
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
                  disabled={correcting || !initial.auditId}
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
          {initial.auditId && <GenerateDraft auditId={initial.auditId} />}
        </div>
      </section>
    </div>
  )
}
