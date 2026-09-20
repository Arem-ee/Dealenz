"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Section } from "./Section"
import type { CounterpartyMemory } from "@/lib/counterparty/memory"
import { getCounterpartyMemory, linkCounterpartyClient } from "@/app/audit/[id]/counterparty-actions"

// Counterparty history inside negotiation prep: who this is, what came up
// in past deals with them, and what got resolved. Unlinked deals offer a
// one-line link form instead of a dead end; first-time counterparties say
// so honestly. Patterns to prepare with, never promises.
export function CounterpartyMemorySection({ auditId }: { auditId: string | null | undefined }) {
  const [memory, setMemory] = useState<CounterpartyMemory | null>(null)
  const [loading, setLoading] = useState<boolean>(() => Boolean(auditId))
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  useEffect(() => {
    if (!auditId) return
    let cancelled = false
    getCounterpartyMemory(auditId)
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setMemory(res.memory)
          setError(null)
        } else setError(res.error)
      })
      .catch(() => {
        if (!cancelled) setError("Could not load counterparty history.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [auditId])

  if (!auditId) return null

  async function handleLink() {
    if (!name.trim() || !auditId || linking) return
    setLinking(true)
    setLinkError(null)
    try {
      const res = await linkCounterpartyClient(auditId, { name: name.trim() })
      if (!res.ok) {
        setLinkError(res.error)
        return
      }
      setName("")
      const refreshed = await getCounterpartyMemory(auditId)
      if (refreshed.ok) setMemory(refreshed.memory)
    } catch {
      setLinkError("Could not link the counterparty. Please try again.")
    } finally {
      setLinking(false)
    }
  }

  return (
    <Section title="Counterparty history" hint="What came up last time with them, and what got resolved.">
      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading history…
        </p>
      )}
      {!loading && error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {!loading && !error && memory && !memory.hasIdentity && (
        <div>
          <p className="text-xs text-muted-foreground">
            This deal is not linked to a counterparty yet. Name them to compare across deals.
          </p>
          <div className="mt-2 flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Counterparty name"
              aria-label="Counterparty name"
              disabled={linking}
              className="h-8 text-xs"
            />
            <Button size="sm" disabled={linking || !name.trim()} onClick={() => void handleLink()}>
              {linking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Link"}
            </Button>
          </div>
          {linkError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {linkError}
            </p>
          )}
        </div>
      )}
      {!loading && !error && memory?.hasIdentity && memory.pastDeals.length === 0 && (
        <p className="text-xs text-muted-foreground">
          First deal with {memory.clientName} — nothing to compare yet.
        </p>
      )}
      {!loading && !error && memory?.hasIdentity && memory.pastDeals.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {memory.pastDeals.length} past deal{memory.pastDeals.length === 1 ? "" : "s"} with {memory.clientName}.
          </p>
          {memory.pastDeals.map((d) => (
            <div key={d.id} className="rounded-xl border bg-card p-3">
              <p className="text-xs font-medium">
                {d.title} <span className="font-normal text-muted-foreground">· {d.dealType.replace("_", " ")} · {d.status.replace("_", " ")}</span>
              </p>
              {d.resolved.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-[11px] font-medium text-emerald-700">Pushed back and resolved last time:</p>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                    {d.resolved.slice(0, 4).map((r) => (
                      <li key={r.ruleKey}>{r.summary || r.ruleKey}</li>
                    ))}
                  </ul>
                </div>
              )}
              {d.flagged.length > 0 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Flagged: {d.flagged.slice(0, 3).map((f) => f.summary).join(" · ")}
                  {d.flagged.length > 3 ? ` +${d.flagged.length - 3} more` : ""}
                </p>
              )}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Patterns, not promises — each deal differs.</p>
        </div>
      )}
    </Section>
  )
}
