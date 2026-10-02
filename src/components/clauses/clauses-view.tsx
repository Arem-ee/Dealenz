"use client"

import { useEffect, useState } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { ScrollText } from "lucide-react"
import { cn } from "@/lib/utils"
import { RULE_DEAL_TYPES } from "@/lib/standing/rules"
import {
  addPosition,
  deletePosition,
  listPositions,
  updatePosition,
  type Position,
} from "@/app/(app)/clauses/actions"

const DEAL_TYPES = ["Founder", "Partnership", "Purchase/Sale", "Lease", "Employment", "Freelance"]

const TRACKED_STATUSES = ["Suggested", "In draft", "Needs input", "Signed"]

const STARTERS = [
  "I never accept net-60 payment terms",
  "Always flag uncapped liability",
  "Always flag broad indemnity without a cap",
  "I need a termination-for-convenience clause",
  "Flag any auto-renewal without a notice window",
  "IP I create stays mine unless the price reflects a buyout",
]

function scopeLabel(dealTypes: string[]): string {
  if (dealTypes.length === 0) return "Every deal"
  return dealTypes.map((t) => t.replace("_", " ")).join(" · ")
}

function ScopePicker({ value, onChange, idPrefix }: { value: string[]; onChange: (next: string[]) => void; idPrefix: string }) {
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t])
  return (
    <fieldset>
      <legend className="text-[11px] font-medium text-muted-foreground">
        Applies to {value.length === 0 ? "every deal" : "selected deal types"}
      </legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {RULE_DEAL_TYPES.map((t) => (
          <label
            key={t}
            htmlFor={`${idPrefix}-${t}`}
            className={cn(
              "cursor-pointer border px-2.5 py-1 text-[11px] font-medium transition-colors",
              value.includes(t)
                ? "border-foreground bg-muted font-semibold text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <input
              id={`${idPrefix}-${t}`}
              type="checkbox"
              checked={value.includes(t)}
              onChange={() => toggle(t)}
              className="sr-only"
            />
            {t.replace("_", " ")}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// Clauses tab: positions (standing rules, the constant context) on top,
// library language in the middle, tracked per-deal states at the bottom.
export function ClausesView() {
  const [dealType, setDealType] = useState<string>("All")
  const [positions, setPositions] = useState<Position[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newText, setNewText] = useState("")
  const [newScope, setNewScope] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [editScope, setEditScope] = useState<string[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    listPositions()
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          setLoadError(res.error)
          setPositions([])
          return
        }
        setPositions(res.positions)
      })
      .catch(() => {
        if (!live) return
        setLoadError("Positions failed to load.")
        setPositions([])
      })
    return () => {
      live = false
    }
  }, [])

  async function handleAdd(preset?: string, scope: string[] = []) {
    const text = (preset ?? newText).trim()
    if (!text || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await addPosition({ text, dealTypes: preset !== undefined ? scope : newScope })
      if (!res.ok) throw new Error(res.error)
      setNewText("")
      setNewScope([])
      setPositions((prev) => (prev === null ? [res.position] : [...prev, res.position]))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Position not saved.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return
    setSaving(true)
    setError(null)
    try {
      const res = await updatePosition({ id: editingId, text: editText, dealTypes: editScope })
      if (!res.ok) throw new Error(res.error)
      setPositions((prev) => (prev ?? []).map((p) => (p.id === editingId ? res.position : p)))
      setEditingId(null)
      setEditText("")
      setEditScope([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Position not saved.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return
    setDeletingId(id)
    setError(null)
    try {
      const res = await deletePosition({ id })
      if (!res.ok) throw new Error(res.error)
      setPositions((prev) => (prev ?? []).filter((p) => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Position not deleted.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Clauses</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            What you believe, what it says, where each deal stands.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-6" aria-label="Filter by deal type">
        {["All", ...DEAL_TYPES].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setDealType(t)}
            aria-pressed={dealType === t}
            className={cn(
              "border px-2.5 py-1 text-xs font-medium transition-colors",
              dealType === t
                ? "border-foreground bg-muted font-semibold text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <section aria-label="Positions" id="positions" className="shrink-0">
        <h2 className="text-sm font-semibold">Positions</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Standing rules, written once, applied to every answer and analysis. Short and specific beats long and vague.
        </p>

        {positions === null ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading positions…
          </p>
        ) : (
          <>
            {loadError && (
              <p role="alert" className="mt-3 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">{loadError}</p>
            )}
            {positions.length === 0 ? (
              <div className="mt-3">
                <p className="text-[13px] font-medium">No positions yet — start with one of these:</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void handleAdd(s, [])}
                      disabled={saving}
                      className="border border-border px-2.5 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {positions.map((p) => (
                  <li key={p.id} className="border border-border px-3 py-2.5">
                    {editingId === p.id ? (
                      <div className="space-y-2">
                        <input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          maxLength={300}
                          aria-label="Edit position"
                          className="h-9 w-full border border-input bg-background px-2 text-sm outline-none"
                        />
                        <ScopePicker value={editScope} onChange={setEditScope} idPrefix={`edit-${p.id}`} />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit()}
                            disabled={saving || !editText.trim()}
                            className="h-8 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px]">{p.text}</p>
                          <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{scopeLabel(p.dealTypes)}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            aria-label={`Edit position: ${p.text}`}
                            onClick={() => {
                              setEditingId(p.id)
                              setEditText(p.text)
                              setEditScope(p.dealTypes)
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete position: ${p.text}`}
                            onClick={() => void handleDelete(p.id)}
                            disabled={deletingId === p.id}
                            className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 border border-border p-3" aria-label="Add a position">
              <div className="flex gap-1.5">
                <input
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void handleAdd()
                    }
                  }}
                  maxLength={300}
                  placeholder="e.g. I never accept net-60"
                  aria-label="New position"
                  className="h-9 min-w-0 flex-1 border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/60"
                />
                <button
                  type="button"
                  onClick={() => void handleAdd()}
                  disabled={saving || !newText.trim()}
                  aria-label="Add position"
                  className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-primary-foreground disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2">
                <ScopePicker value={newScope} onChange={setNewScope} idPrefix="new-position" />
              </div>
              {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
              <p className="mt-2 text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
                {(positions ?? []).length} of 20 positions.
              </p>
            </div>
          </>
        )}
      </section>

      <section aria-label="Clause library" className="mt-6 shrink-0">
        <h2 className="text-sm font-semibold">Library</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drafting suggestions, never law — confirm enforceability with a lawyer when it matters.
        </p>
        <div className="mt-2 border border-dashed px-4 py-10 text-center">
          <ScrollText className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No clauses in the library yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Templates seed here with this tab&apos;s functions.
          </p>
        </div>
      </section>

      <section aria-label="Tracked clauses" className="mt-6 shrink-0">
        <h2 className="text-sm font-semibold">Tracked</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Every clause suggested or used in every deal, with its state.
        </p>
        <div className="mt-2 border border-dashed px-4 py-10 text-center">
          <p className="text-sm font-medium">Nothing tracked yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Clauses move through {TRACKED_STATUSES.join(" → ")} as deals progress. Tracking wires up with this tab&apos;s functions.
          </p>
        </div>
      </section>
    </div>
  )
}
