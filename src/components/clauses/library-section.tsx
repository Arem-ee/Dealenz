"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { RULE_DEAL_TYPES } from "@/lib/standing/rules"
import { LOCALES, type AppLocale } from "@/lib/i18n/locale"
import { latestUsableEntries, missingVariants, type LibraryClauseVariant } from "@/lib/library/entries"
import { useToast } from "@/components/ui/toast"
import {
  addCustomClause,
  addLineVariant,
  deleteClauseLine,
  deprecateClause,
  listLibrary,
  listStandardClauses,
  saveClauseVersion,
  saveStandardClause,
  type LibraryEntry,
  type StandardClauseOption,
} from "@/app/(app)/clauses/library"

const VARIANT_LABEL: Record<LibraryClauseVariant, string> = {
  preferred: "Preferred",
  fallback: "Fallback",
  walkaway: "Walk-away",
}

function scopeLabel(dealTypes: string[]): string {
  if (dealTypes.length === 0) return "Every deal"
  return dealTypes.map((t) => t.replace("_", " ")).join(" · ")
}

// Library: governed clause language in three-tier positions (preferred /
// fallback / walk-away). Standard clauses snapshot in as version 1 with
// provenance; edits mint new versions (history immutable); deprecation
// retires a variant without deleting it.
export function LibrarySection({ dealTypeFilter }: { dealTypeFilter: string }) {
  const { showError } = useToast()
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null)
  const [standard, setStandard] = useState<StandardClauseOption[] | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newBody, setNewBody] = useState("")
  const [newCategory, setNewCategory] = useState("general")
  const [newScope, setNewScope] = useState<string[]>([])
  const [newLanguage, setNewLanguage] = useState<AppLocale>("en")
  const [saving, setSaving] = useState(false)
  const [editingSlot, setEditingSlot] = useState<string | null>(null)
  const [editBody, setEditBody] = useState("")
  const [editNote, setEditNote] = useState("")
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([listLibrary(), listStandardClauses()])
      .then(([lib, std]) => {
        if (!live) return
        if (!lib.ok) showError(lib.error, "Library failed to load")
        else setEntries(lib.entries)
        if (!std.ok) showError(std.error, "Standard clauses failed to load")
        else setStandard(std.clauses)
        if (!lib.ok) setEntries([])
        if (!std.ok) setStandard([])
      })
      .catch(() => {
        if (!live) return
        showError("Library failed to load")
        setEntries([])
        setStandard([])
      })
    return () => {
      live = false
    }
  }, [showError])

  const heads = useMemo(
    () =>
      latestUsableEntries(
        (entries ?? []).map((e) => ({
          id: e.id, key: e.key, variant: e.variant, language: e.language, version: e.version, title: e.title, body: e.body,
          category: e.category, dealTypes: e.dealTypes, status: e.status, changeNote: e.changeNote,
          templateId: e.templateId, templateVersion: e.templateVersion, useCount: e.useCount,
          lastUsedAt: e.lastUsedAt, createdAt: e.createdAt,
        }))
      ),
    [entries]
  )

  const lines = useMemo(() => {
    const byLine = new Map<string, typeof heads>()
    for (const h of heads) {
      const lineKey = `${h.key}::${h.language}`
      const list = byLine.get(lineKey) ?? []
      list.push(h)
      byLine.set(lineKey, list)
    }
    const all = [...byLine.entries()].map(([lineKey, variants]) => {
      const [key, language] = lineKey.split("::") as [string, string]
      const first = variants[0]!
      const full = (entries ?? []).find((e) => e.id === first.id)!
      return { key, language, title: first.title, category: first.category, dealTypes: full.dealTypes, variants }
    })
    if (dealTypeFilter === "All") return all
    const want = dealTypeFilter.toLowerCase()
    return all.filter(
      (l) => l.dealTypes.length === 0 || l.dealTypes.some((s) => s === want.replace("/", "_").replace(" ", "_") || s.replace("_", " ") === want)
    )
  }, [heads, entries, dealTypeFilter])

  const historyFor = (key: string, variant: LibraryClauseVariant, language: string) =>
    (entries ?? [])
      .filter((e) => e.key === key && e.variant === variant && e.language === language)
      .sort((a, b) => b.version - a.version)

  async function refresh() {
    const res = await listLibrary()
    if (res.ok) setEntries(res.entries)
    const std = await listStandardClauses()
    if (std.ok) setStandard(std.clauses)
  }

  async function handleAddCustom() {
    if (saving || !newTitle.trim() || !newBody.trim()) return
    setSaving(true)
    try {
      const res = await addCustomClause({ title: newTitle, body: newBody, category: newCategory, dealTypes: newScope, language: newLanguage })
      if (!res.ok) throw new Error(res.error)
      setNewTitle("")
      setNewBody("")
      setNewCategory("general")
      setNewScope([])
      setNewLanguage("en")
      setShowAdd(false)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Clause not saved.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveVersion(head: LibraryEntry) {
    if (busyId) return
    setBusyId(head.id)
    try {
      const res = await saveClauseVersion({ id: head.id, body: editBody, changeNote: editNote })
      if (!res.ok) throw new Error(res.error)
      setEditingSlot(null)
      setEditBody("")
      setEditNote("")
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Version not saved.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleAddVariant(key: string, variant: LibraryClauseVariant) {
    if (busyId) return
    setBusyId(`${key}:${variant}`)
    try {
      const res = await addLineVariant({ key, variant })
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Variant not added.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeprecate(head: LibraryEntry) {
    if (busyId) return
    setBusyId(head.id)
    try {
      const res = await deprecateClause({ id: head.id })
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Clause not retired.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteLine(key: string) {
    if (busyId) return
    setBusyId(key)
    try {
      const res = await deleteClauseLine({ key })
      if (!res.ok) throw new Error(res.error)
      setConfirmDeleteKey(null)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Clause not deleted.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleSaveStandard(id: string) {
    if (busyId) return
    setBusyId(id)
    try {
      const res = await saveStandardClause({ templateId: id })
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Clause not saved.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      {entries === null ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading library…
        </p>
      ) : lines.length === 0 ? (
        <div className="mt-2 border border-dashed px-4 py-10 text-center">
          <p className="text-sm font-medium">No clauses in the library yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Save a standard clause below, or add your own approved language.
          </p>
        </div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {lines.map((line) => {
            const missing = missingVariants(
              (entries ?? []).map((e) => ({
                id: e.id, key: e.key, variant: e.variant, language: e.language, version: e.version, title: e.title, body: e.body,
                category: e.category, dealTypes: e.dealTypes, status: e.status, changeNote: e.changeNote,
                templateId: e.templateId, templateVersion: e.templateVersion, useCount: e.useCount,
                lastUsedAt: e.lastUsedAt, createdAt: e.createdAt,
              })),
              line.key,
              line.language as "en" | "fr" | "de" | "nl"
            )
            const uses = Math.max(...line.variants.map((v) => {
              const full = (entries ?? []).find((e) => e.id === v.id)
              return full?.useCount ?? 0
            }))
            return (
              <li key={`${line.key}::${line.language}`} className="border border-border px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">
                      {line.title}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {line.language.toUpperCase()} · {line.category} · {scopeLabel(line.dealTypes)}
                        {uses > 0 ? ` · used ${uses}×` : ""}
                      </span>
                    </p>
                    {missing.includes("walkaway") ? (
                      <p className="mt-0.5 text-[11px] text-destructive">
                        No walk-away defined — this line concedes under pressure.
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete clause line: ${line.title}`}
                    onClick={() => setConfirmDeleteKey(line.key)}
                    className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {line.variants.map((v) => {
                  const full = (entries ?? []).find((e) => e.id === v.id)!
                  const history = historyFor(line.key, v.variant, line.language)
                  const slot = `${line.key}:${v.variant}:${line.language}`
                  const isEditing = editingSlot === slot
                  return (
                    <div key={v.variant} className="mt-2 border-t border-border pt-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold">
                          {VARIANT_LABEL[v.variant]}{" "}
                          <span className="font-normal text-muted-foreground">
                            v{full.version}
                            {full.status === "deprecated" ? " · retired" : ""}
                            {history.length > 1 ? ` · ${history.length} versions` : ""}
                          </span>
                        </p>
                        <button
                          type="button"
                          aria-label={`Edit ${VARIANT_LABEL[v.variant]}: ${line.title}`}
                          onClick={() => {
                            setEditingSlot(slot)
                            setEditBody(full.body)
                            setEditNote("")
                          }}
                          className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{full.body}</p>
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            rows={4}
                            maxLength={8000}
                            aria-label="Edited clause language"
                            className="w-full border border-input bg-background px-2 py-1.5 text-xs outline-none"
                          />
                          <input
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            maxLength={280}
                            placeholder="What changed and why (goes in history)"
                            aria-label="Change note"
                            className="h-9 w-full border border-input bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/60"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveVersion(full)}
                              disabled={busyId === full.id || !editBody.trim()}
                              className="h-8 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                            >
                              Save as v{full.version + 1}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSlot(null)}
                              className="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                            {full.status === "active" ? (
                              <button
                                type="button"
                                onClick={() => void handleDeprecate(full)}
                                disabled={busyId === full.id}
                                className="h-8 px-2 text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-50"
                              >
                                Retire variant
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {history.length > 1 && !isEditing ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          History: {history.map((h) => `v${h.version}${h.changeNote ? ` — ${h.changeNote}` : ""}`).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  )
                })}

                {missing.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
                    {missing.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => void handleAddVariant(line.key, m)}
                        disabled={busyId === `${line.key}:${m}`}
                        className="h-7 border border-border px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        Add {VARIANT_LABEL[m]}
                      </button>
                    ))}
                  </div>
                ) : null}

                {confirmDeleteKey === line.key ? (
                  <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                    <p className="text-[11px] text-muted-foreground">Delete this line, all variants, versions, and languages?</p>
                    <button
                      type="button"
                      onClick={() => void handleDeleteLine(line.key)}
                      disabled={busyId === line.key}
                      className="h-7 bg-destructive px-2.5 text-[11px] font-semibold text-destructive-foreground disabled:opacity-50"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteKey(null)}
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Keep
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-3 border border-border p-3" aria-label="Add a custom clause">
        {showAdd ? (
          <div className="space-y-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={120}
              placeholder="Clause title, e.g. Net-60 rejection"
              aria-label="Clause title"
              className="h-9 w-full border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={4}
              maxLength={8000}
              placeholder="Approved language — {{variables}} stay as blanks"
              aria-label="Clause language"
              className="w-full border border-input bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/60"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                maxLength={40}
                placeholder="Category"
                aria-label="Clause category"
                className="h-8 w-36 border border-input bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/60"
              />
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={newLanguage === l}
                  onClick={() => setNewLanguage(l)}
                  className={cn(
                    "border px-2 py-1 text-[11px] font-medium uppercase transition-colors",
                    newLanguage === l
                      ? "border-foreground bg-muted font-semibold text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l}
                </button>
              ))}
              {RULE_DEAL_TYPES.filter((t) => t !== "generic").map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={newScope.includes(t)}
                  onClick={() => setNewScope((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
                  className={cn(
                    "border px-2 py-1 text-[11px] font-medium transition-colors",
                    newScope.includes(t)
                      ? "border-foreground bg-muted font-semibold text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.replace("_", " ")}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleAddCustom()}
                disabled={saving || !newTitle.trim() || !newBody.trim()}
                className="h-8 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
              >
                Save clause
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex h-9 w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Add your own approved language
          </button>
        )}
      </div>

      <div className="mt-4" aria-label="Standard clauses">
        <h3 className="text-xs font-semibold">Standard clauses</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Drafting suggestions from the built-in set — save one to make it yours, then version it.
        </p>
        {standard === null ? (
          <p className="mt-2 text-xs text-muted-foreground">Loading standard clauses…</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {standard.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-2 border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{s.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{s.purpose}</p>
                </div>
                {s.inLibrary ? (
                  <span className="shrink-0 px-2 py-1 text-[11px] font-medium text-muted-foreground">Saved</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSaveStandard(s.id)}
                    disabled={busyId === s.id}
                    className="h-7 shrink-0 border border-border px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Save
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
