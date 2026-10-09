"use client"

import { useEffect, useMemo, useState } from "react"
import { Link2, Loader2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { latestUsableEntries, type LibraryClauseVariant } from "@/lib/library/entries"
import { checkLinkStructure } from "@/lib/pairing/links"
import { useToast } from "@/components/ui/toast"
import { listPositions, type Position } from "@/app/(app)/clauses/actions"
import { listLibrary, type LibraryEntry } from "@/app/(app)/clauses/library"
import {
  linkPosition,
  listPositionLinks,
  unlinkPosition,
  updatePositionLink,
  type PositionWithLinks,
} from "@/app/(app)/clauses/pairing"

const VARIANT_LABEL: Record<LibraryClauseVariant, string> = {
  preferred: "Preferred",
  fallback: "Fallback",
  walkaway: "Walk-away",
}

// Pairings: positions bound to exact library language. The preferred slot
// is the standing wording reused verbatim; fallback rungs carry when/why;
// walk-away is the floor. One library update propagates to every link.
export function PairingSection() {
  const { showError } = useToast()
  const [positions, setPositions] = useState<Position[] | null>(null)
  const [paired, setPaired] = useState<PositionWithLinks[] | null>(null)
  const [library, setLibrary] = useState<LibraryEntry[] | null>(null)
  const [linkingFor, setLinkingFor] = useState<string | null>(null)
  const [pickKey, setPickKey] = useState("")
  const [pickVariant, setPickVariant] = useState<LibraryClauseVariant>("preferred")
  const [pickCondition, setPickCondition] = useState("")
  const [pickEscalate, setPickEscalate] = useState(false)
  const [pickInsert, setPickInsert] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([listPositions(), listPositionLinks(), listLibrary()])
      .then(([p, l, lib]) => {
        if (!live) return
        if (!p.ok) showError(p.error, "Positions failed to load")
        else setPositions(p.positions)
        if (!l.ok) showError(l.error, "Pairings failed to load")
        else setPaired(l.positions)
        if (!lib.ok) showError(lib.error, "Library failed to load")
        else setLibrary(lib.entries)
        if (!p.ok) setPositions([])
        if (!l.ok) setPaired([])
        if (!lib.ok) setLibrary([])
      })
      .catch(() => {
        if (!live) return
        showError("Pairings failed to load")
        setPositions([])
        setPaired([])
        setLibrary([])
      })
    return () => {
      live = false
    }
  }, [showError])

  const heads = useMemo(
    () =>
      latestUsableEntries(
        (library ?? []).map((e) => ({
          id: e.id, key: e.key, variant: e.variant, language: e.language, version: e.version, title: e.title, body: e.body,
          category: e.category, dealTypes: e.dealTypes, status: e.status, changeNote: e.changeNote,
          templateId: e.templateId, templateVersion: e.templateVersion, useCount: e.useCount,
          lastUsedAt: e.lastUsedAt, createdAt: e.createdAt,
        }))
      ),
    [library]
  )

  async function refresh() {
    const [p, l] = await Promise.all([listPositions(), listPositionLinks()])
    if (p.ok) setPositions(p.positions)
    if (l.ok) setPaired(l.positions)
  }

  async function addLink(positionId: string) {
    if (busy || !pickKey) return
    setBusy(true)
    try {
      const [key, variant] = pickKey.split("::")
      const res = await linkPosition({
        positionId,
        libraryKey: key ?? "",
        variant: (variant as LibraryClauseVariant) ?? "preferred",
        condition: pickVariant === "fallback" ? pickCondition : "",
        escalate: pickVariant !== "preferred" && pickEscalate,
        insertOnMissing: pickVariant === "preferred" && pickInsert,
      })
      if (!res.ok) throw new Error(res.error)
      setLinkingFor(null)
      setPickKey("")
      setPickCondition("")
      setPickEscalate(false)
      setPickInsert(false)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Link not saved.")
    } finally {
      setBusy(false)
    }
  }

  async function removeLink(id: string) {
    if (busy) return
    setBusy(true)
    try {
      const res = await unlinkPosition({ id })
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Link not removed.")
    } finally {
      setBusy(false)
    }
  }

  async function toggleFlag(id: string, patch: { escalate?: boolean; insertOnMissing?: boolean }) {
    if (busy) return
    setBusy(true)
    try {
      const res = await updatePositionLink({ id, ...patch })
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Link not saved.")
    } finally {
      setBusy(false)
    }
  }

  if (positions === null || paired === null) {
    return (
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pairings…
      </p>
    )
  }

  if (positions.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Write a position above first — pairings bind standing rules to exact language.
      </p>
    )
  }

  const pairedById = new Map(paired.map((p) => [p.id, p]))

  return (
    <ul className="mt-2 space-y-1.5">
      {positions.map((p) => {
        const entry = pairedById.get(p.id)
        const links = entry?.links ?? []
        const warnings = checkLinkStructure(
          links.map((l) => ({
            libraryKey: l.libraryKey, variant: l.variant, rung: l.rung,
            conditionText: l.conditionText, escalate: l.escalate, insertOnMissing: l.insertOnMissing,
          }))
        )
        return (
          <li key={p.id} className="border border-border px-3 py-2.5">
            <p className="text-[13px] font-medium">{p.text}</p>
            {links.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">Unpaired — prose only, no enforced language.</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {links.map((l) => (
                  <li key={l.id} className="border-l-2 border-muted-foreground/30 pl-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">
                          {VARIANT_LABEL[l.variant]}
                          {l.variant === "fallback" ? <span className="font-normal text-muted-foreground"> · rung {l.rung}</span> : null}
                          <span className="font-normal text-muted-foreground"> · {l.languageTitle} v{l.languageVersion}</span>
                        </p>
                        {l.conditionText ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Offer when: {l.conditionText}</p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {l.escalate ? "Escalates. " : ""}
                          {l.insertOnMissing ? "Inserts when missing. " : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-pressed={l.escalate}
                          disabled={busy || l.variant === "preferred"}
                          title={l.variant === "preferred" ? "Preferred never escalates" : "Toggle escalation"}
                          onClick={() => void toggleFlag(l.id, { escalate: !l.escalate })}
                          className={cn(
                            "h-6 border px-1.5 text-[10px] font-medium transition-colors disabled:opacity-40",
                            l.escalate
                              ? "border-foreground bg-muted text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Esc
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove link: ${l.languageTitle}`}
                          onClick={() => void removeLink(l.id)}
                          disabled={busy}
                          className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {warnings.length > 0 ? (
              <ul className="mt-1.5 space-y-0.5" aria-label="Pairing warnings">
                {warnings.map((w) => (
                  <li key={w.code} className="text-[11px] text-destructive">{w.message}</li>
                ))}
              </ul>
            ) : null}
            {linkingFor === p.id ? (
              <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                <div className="flex flex-wrap gap-1.5">
                  <select
                    value={pickKey}
                    onChange={(e) => {
                      setPickKey(e.target.value)
                      const [, v] = e.target.value.split("::")
                      if (v === "preferred" || v === "fallback" || v === "walkaway") setPickVariant(v)
                    }}
                    aria-label="Library language"
                    className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none"
                  >
                    <option value="">Pick library language…</option>
                    {heads.map((h) => (
                      <option key={`${h.key}::${h.variant}`} value={`${h.key}::${h.variant}`}>
                        {h.title} — {VARIANT_LABEL[h.variant]} v{h.version}
                      </option>
                    ))}
                  </select>
                </div>
                {pickVariant === "fallback" ? (
                  <input
                    value={pickCondition}
                    onChange={(e) => setPickCondition(e.target.value)}
                    maxLength={500}
                    placeholder="Offer when… (required for fallbacks)"
                    aria-label="When condition"
                    className="h-8 w-full border border-input bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/60"
                  />
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {pickVariant !== "preferred" ? (
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={pickEscalate}
                        onChange={(e) => setPickEscalate(e.target.checked)}
                        className="h-3.5 w-3.5 accent-foreground"
                      />
                      Escalate past this rung
                    </label>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={pickInsert}
                        onChange={(e) => setPickInsert(e.target.checked)}
                        className="h-3.5 w-3.5 accent-foreground"
                      />
                      Suggest insertion when missing
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => void addLink(p.id)}
                    disabled={busy || !pickKey}
                    className="h-7 bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    Link language
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkingFor(null)}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLinkingFor(p.id)
                  setPickKey("")
                  setPickCondition("")
                  setPickEscalate(false)
                  setPickInsert(false)
                }}
                className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <Link2 className="h-3 w-3" /> Link library language
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
