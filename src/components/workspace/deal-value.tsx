"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatDealValue } from "@/lib/deals/value"
import { updateDealValue } from "@/lib/deals/value-actions"

// Deal value editor: compact card in the work surface. History reads
// "No value on file" (absent, never zero); saving writes columns plus
// user_confirmed envelope fields through one action.
export function DealValue({ auditId, minor, currency }: {
  auditId: string | null
  minor: number | null
  currency: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState("")
  const [curr, setCurr] = useState(currency ?? "USD")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!auditId) return null

  async function save() {
    if (busy || !amount.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await updateDealValue({ auditId: auditId as string, amount: amount.trim(), currency: curr })
      if (!res.ok) throw new Error(res.error)
      setEditing(false)
      setAmount("")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save that.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-border bg-background p-4" aria-label="Deal value">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deal value</p>
      {!editing ? (
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-sm tabular-nums">
            {minor !== null && currency ? formatDealValue(minor, currency) : <span className="text-muted-foreground">No value on file</span>}
          </p>
          <button
            type="button"
            onClick={() => { setEditing(true); setError(null) }}
            className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {minor !== null ? "Edit" : "Add"}
          </button>
        </div>
      ) : (
        <div>
          <div className="mt-2 flex gap-1.5">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,\s]/g, ""))}
              disabled={busy}
              inputMode="decimal"
              placeholder="48,500.00"
              aria-label="Deal value amount"
              autoComplete="off"
              className="h-9 min-w-0 flex-1 border border-input bg-background px-2 text-sm outline-none disabled:opacity-60"
            />
            <select
              value={curr}
              onChange={(e) => setCurr(e.target.value)}
              disabled={busy}
              aria-label="Deal value currency"
              className="h-9 shrink-0 border border-input bg-background px-1.5 text-xs disabled:opacity-60"
            >
              {["USD", "GBP", "EUR", "NGN"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {error && <p role="alert" className="mt-1.5 border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">{error}</p>}
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !amount.trim()}
              className="inline-flex h-8 items-center bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null) }}
              className="inline-flex h-8 items-center px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
