"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { draftFamilies, generateDraft, type FamilyOption } from "@/app/(app)/drafts/actions"

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// Generate-draft panel: family, optional jurisdiction, merge fields with
// blanks allowed. Missing variables flow as fillable blanks (standard
// friction) — send stays blocked downstream until assigned.
export function GenerateDraft({ auditId }: { auditId: string }) {
  const [families, setFamilies] = useState<FamilyOption[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [familyId, setFamilyId] = useState("")
  const [jurisdiction, setJurisdiction] = useState("")
  const [language, setLanguage] = useState("en")
  const [vars, setVars] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ familyTitle: string; versionNumber: number; missingVariables: string[]; language: string; languageFallbacks: string[] } | null>(null)

  useEffect(() => {
    let live = true
    draftFamilies(auditId)
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          setLoadError(res.error)
          setFamilies([])
          return
        }
        setFamilies(res.families)
        if (res.families.length > 0) setFamilyId(res.families[0]!.id)
      })
      .catch(() => {
        if (!live) return
        setLoadError("Couldn't load document options.")
        setFamilies([])
      })
    return () => {
      live = false
    }
  }, [auditId])

  const selected = families?.find((f) => f.id === familyId) ?? null

  async function generate() {
    if (!familyId || busy) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await generateDraft({ auditId, familyId, jurisdiction, variables: vars, language })
      if (!res.ok) throw new Error(res.error)
      setDone({ familyTitle: res.familyTitle, versionNumber: res.versionNumber, missingVariables: res.missingVariables, language: res.language, languageFallbacks: res.languageFallbacks })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft generation failed. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (families === null) {
    return (
      <div className="flex items-center gap-2 border border-border bg-background p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading document options…
      </div>
    )
  }
  if (families.length === 0) {
    return (
      <div className="border border-border bg-background p-4">
        <p className="text-sm font-medium">No draft families for this deal type</p>
        <p className="mt-1 text-xs text-muted-foreground">{loadError ?? "Drafting covers founder, partnership, purchase, lease, and employment deals."}</p>
      </div>
    )
  }

  return (
    <div className="border border-border bg-background p-4" aria-label="Generate draft">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Generate draft</p>
      <label className="mt-2 block text-[11px] font-medium text-muted-foreground" htmlFor="draft-family">Document</label>
      <select
        id="draft-family"
        value={familyId}
        onChange={(e) => {
          setFamilyId(e.target.value)
          setVars({})
          setDone(null)
        }}
        disabled={busy}
        className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm disabled:opacity-60"
      >
        {families.map((f) => (
          <option key={f.id} value={f.id}>{f.title}</option>
        ))}
      </select>
      {selected && <p className="mt-1 text-[11px] text-muted-foreground">{selected.description}</p>}

      <label className="mt-3 block text-[11px] font-medium text-muted-foreground" htmlFor="draft-language">
        Agreement language
      </label>
      <select
        id="draft-language"
        value={language}
        onChange={(e) => {
          setLanguage(e.target.value)
          setDone(null)
        }}
        disabled={busy}
        className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm disabled:opacity-60"
      >
        <option value="en">English</option>
        <option value="fr">Français — approved lines only, rest in English</option>
        <option value="de">Deutsch — approved lines only, rest in English</option>
      </select>

      <label className="mt-3 block text-[11px] font-medium text-muted-foreground" htmlFor="draft-jurisdiction">
        Jurisdiction <span className="font-normal">(optional)</span>
      </label>
      <input
        id="draft-jurisdiction"
        value={jurisdiction}
        onChange={(e) => setJurisdiction(e.target.value)}
        disabled={busy}
        placeholder="e.g. Nigeria, Delaware, England"
        autoComplete="off"
        className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
      />

      {selected && selected.variables.length > 0 && (
        <div className="mt-3 space-y-2">
          {selected.variables.map((v) => (
            <div key={v}>
              <label className="block text-[11px] font-medium text-muted-foreground" htmlFor={`draft-var-${v}`}>
                {humanize(v)}
              </label>
              <input
                id={`draft-var-${v}`}
                value={vars[v] ?? ""}
                onChange={(e) => setVars((prev) => ({ ...prev, [v]: e.target.value }))}
                disabled={busy}
                autoComplete="off"
                className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
              />
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Blanks stay blank — fill them before anything moves toward signature.</p>
        </div>
      )}

      {error && <p role="alert" className="mt-3 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">{error}</p>}
      {done && (
        <div className="mt-3 border border-border bg-muted/40 px-2.5 py-2 text-xs" role="status">
          <p><strong>{done.familyTitle}</strong> v{done.versionNumber} saved{done.language !== "en" ? ` in ${done.language.toUpperCase()}` : ""}.</p>
          {done.missingVariables.length > 0 && (
            <p className="mt-1 text-muted-foreground">Still blank: {done.missingVariables.join(", ")}</p>
          )}
          {done.languageFallbacks.length > 0 && (
            <p className="mt-1 text-muted-foreground">In English (no approved {done.language.toUpperCase()} line yet): {done.languageFallbacks.length} clause{done.languageFallbacks.length === 1 ? "" : "s"}</p>
          )}
          <Link href="/drafts" className="mt-1 inline-block font-medium text-primary hover:underline">Open in Drafts →</Link>
        </div>
      )}

      <button
        type="button"
        onClick={() => void generate()}
        disabled={busy || !familyId}
        className="mt-3 inline-flex h-9 items-center bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        {busy ? "Generating…" : "Generate draft"}
      </button>
    </div>
  )
}
