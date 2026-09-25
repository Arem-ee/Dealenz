"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createAudit } from "@/app/audit/new/actions"
import { DealTypeSelector, type DealType } from "@/components/audit/deal-type-selector"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, X, Files } from "lucide-react"
import { uploadAndAttachFile } from "@/lib/files/attach"
import { createBatchAnalysisPlan, suggestBatchDealTypes } from "@/lib/work/actions"
import { MAX_BATCH_DEALS } from "@/lib/work/schema"
import { normalizeDealType } from "@/lib/deal-type"
import { ANALYSIS_CREDITS, UPLOAD_CREDITS } from "@/lib/credits/pricing"

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED = ["pdf", "docx", "txt"]

const TYPE_LABELS: Record<DealType, string> = {
  founder: "Founder",
  partnership: "Partnership",
  purchase_sale: "Purchase / Sale",
  lease: "Lease",
  employment: "Employment",
  freelance: "Freelance",
  generic: "Generic",
}

const TYPE_OPTIONS = (Object.keys(TYPE_LABELS) as DealType[]).map((value) => ({ value, label: TYPE_LABELS[value] }))

function fileError(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!ACCEPTED.includes(ext)) return "Dealenz reads PDF, DOCX, and TXT files."
  if (file.size <= 0 || file.size > MAX_BYTES) return "Files must be non-empty and under 10 MB."
  return null
}

interface BatchRow {
  key: string
  name: string
  size: number
  auditId: string
  threadId: string
  detected: DealType
  selected: DealType
  touched: boolean
}

export default function BatchNewPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dealType, setDealType] = useState<DealType | null>(null)
  const [rows, setRows] = useState<BatchRow[]>([])
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<string | null>(null)
  const [failed, setFailed] = useState<Record<string, string>>({})
  const [failedAudits, setFailedAudits] = useState<Record<string, string>>({})
  const [cleaning, setCleaning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reviewing = rows.length > 0

  function addFiles(incoming: FileList | null) {
    if (!incoming || busy || reviewing) return
    setError(null)
    setFailed({})
    setFiles((prev) => {
      const next = [...prev]
      for (const f of Array.from(incoming)) {
        if (next.length >= MAX_BATCH_DEALS) {
          setError(`A batch holds at most ${MAX_BATCH_DEALS} deals — split the rest into a second batch.`)
          break
        }
        if (next.some((g) => g.name === f.name && g.size === f.size)) continue
        const problem = fileError(f)
        if (problem) {
          setFailed((s) => ({ ...s, [f.name]: problem }))
          continue
        }
        next.push(f)
      }
      return next
    })
    if (inputRef.current) inputRef.current.value = ""
  }

  function removeFile(name: string, size: number) {
    if (busy || reviewing) return
    setFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)))
    setFailed((s) => {
      const next = { ...s }
      delete next[name]
      return next
    })
  }

  function applySharedType(next: DealType) {
    setDealType(next)
    // An explicit shared choice overrides every row's guess.
    setRows((prev) => prev.map((r) => ({ ...r, selected: next, touched: true })))
  }

  function setRowType(key: string, next: DealType) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, selected: next, touched: true } : r)))
  }

  async function handlePrepare() {
    if (files.length === 0 || busy) return
    setBusy(true)
    setError(null)
    setFailed({})
    setFailedAudits({})
    const prepared: BatchRow[] = []
    const fails: Record<string, string> = {}
    const orphans: Record<string, string> = {}
    let done = 0
    for (const f of files) {
      done += 1
      setPhase(`Uploading ${done} of ${files.length} — ${f.name}`)
      const created = await createAudit(dealType ?? undefined)
      if (!created.ok) {
        fails[f.name] = created.error
        continue
      }
      const attached = await uploadAndAttachFile(created.auditId, f)
      if (!attached.ok) {
        fails[f.name] = attached.error
        // The audit row already exists while its file did not land: track
        // it for one-tap cleanup instead of orphaning a dead draft.
        orphans[f.name] = created.auditId
        continue
      }
      prepared.push({
        key: `${f.name}:${f.size}`,
        name: f.name,
        size: f.size,
        auditId: created.auditId,
        threadId: created.threadId,
        // Shared choice seeds every row; auto-sort below refines the rest.
        detected: dealType ?? "freelance",
        selected: dealType ?? "freelance",
        touched: dealType !== null,
      })
    }
    if (prepared.length === 0) {
      setFailed(fails)
      setFailedAudits(orphans)
      setError("None of the files could be prepared. Fix the issues below and try again.")
      setBusy(false)
      setPhase(null)
      return
    }
    // Auto-sort the undecided rows from their own contents: deterministic,
    // free, and never persisted until the plan is created below.
    const undecided = prepared.filter((r) => !r.touched)
    if (undecided.length > 0) {
      setPhase(`Sorting ${undecided.length} deal${undecided.length === 1 ? "" : "s"} by contents`)
      const sorted = await suggestBatchDealTypes({ auditIds: undecided.map((r) => r.auditId) })
      if (sorted.ok) {
        const byId = new Map(sorted.suggestions.map((s) => [s.auditId, normalizeDealType(s.dealType, "generic")]))
        for (const row of prepared) {
          const guess = byId.get(row.auditId)
          if (!row.touched && guess) {
            row.detected = guess
            row.selected = guess
          }
        }
      }
      // A failed sort is not fatal: rows keep the shared/default type and
      // the user can still correct each one below.
    }
    setFailed(fails)
    setFailedAudits(orphans)
    setRows(prepared)
    setBusy(false)
    setPhase(null)
  }

  async function handleCleanupFailed() {
    const entries = Object.entries(failedAudits)
    if (entries.length === 0 || cleaning) return
    setCleaning(true)
    try {
      const { deleteDeal } = await import("@/app/audit/[id]/actions")
      const remaining: Record<string, string> = {}
      for (const [name, auditId] of entries) {
        try {
          const res = await deleteDeal(auditId)
          if (!res.ok) remaining[name] = auditId
        } catch {
          remaining[name] = auditId
        }
      }
      setFailedAudits(remaining)
      if (Object.keys(remaining).length > 0) {
        setError("Some failed drafts could not be removed. They remain as draft deals you can delete from Home.")
      }
    } finally {
      setCleaning(false)
    }
  }

  async function handleCreatePlan() {
    if (rows.length === 0 || busy) return
    setBusy(true)
    setError(null)
    setPhase(`Creating one shared analysis plan for ${rows.length} deal${rows.length === 1 ? "" : "s"}`)
    const batch = await createBatchAnalysisPlan({
      items: rows.map((r) => ({
        auditId: r.auditId,
        threadId: r.threadId,
        dealType: r.selected,
        autoDetected: !r.touched,
      })),
    })
    if (!batch.ok) {
      setError(batch.error)
      setBusy(false)
      setPhase(null)
      return
    }
    router.push(`/chat/${batch.batchThreadId}`)
  }

  function handleBack() {
    if (busy) return
    setRows([])
    setFiles([])
    setFailed({})
    setFailedAudits({})
    setError(null)
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6 my-auto">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Files className="h-5 w-5" />
            Batch analysis
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Drop in up to {MAX_BATCH_DEALS} contracts. Each becomes its own deal with its own results;
            one shared plan approves and runs every analysis at once.
          </p>
        </div>

        {!reviewing && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              className="hidden"
              aria-label="Add contract files"
              onChange={(e) => addFiles(e.target.files)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-4 py-8 text-sm transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              <FileText className="h-6 w-6 text-muted-foreground/60" />
              <span className="font-medium">{files.length === 0 ? "Choose contract files" : "Add more files"}</span>
              <span className="text-xs text-muted-foreground">PDF, DOCX, or TXT · 10 MB each · up to {MAX_BATCH_DEALS}</span>
            </button>

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li key={`${f.name}:${f.size}`} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeFile(f.name, f.size)}
                      aria-label={`Remove ${f.name}`}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <p className="text-xs text-muted-foreground">What kind of deals are these? Optional — each file is also sorted by its contents next.</p>
              <div className="mt-2">
                <DealTypeSelector value={dealType} onChange={setDealType} />
              </div>
            </div>
          </>
        )}

        {reviewing && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Sorted by contents — correct any row before creating the plan. Auto guesses are confirmed per deal during analysis.
            </p>
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate" title={r.name}>{r.name}</span>
                  {!r.touched && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground" title="Sorted by contents — change it if wrong">
                      Auto
                    </span>
                  )}
                  <label className="sr-only" htmlFor={`type-${r.auditId}`}>Deal type for {r.name}</label>
                  <select
                    id={`type-${r.auditId}`}
                    value={r.selected}
                    disabled={busy}
                    onChange={(e) => setRowType(r.key, e.target.value as DealType)}
                    className="h-9 shrink-0 rounded-lg border border-input bg-background px-2 text-xs disabled:opacity-50"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <div>
              <p className="text-xs text-muted-foreground">Apply one type to every row</p>
              <div className="mt-2">
                <DealTypeSelector value={dealType} onChange={applySharedType} />
              </div>
            </div>
          </div>
        )}

        {(files.length > 0 || reviewing) && (
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Cost before you approve anything</p>
            <p className="mt-1">
              Uploads charge now: {(reviewing ? rows.length : files.length)} × {UPLOAD_CREDITS} = {(reviewing ? rows.length : files.length) * UPLOAD_CREDITS} credits.
              Analyses charge on approval: {(reviewing ? rows.length : files.length)} × {ANALYSIS_CREDITS} = {(reviewing ? rows.length : files.length) * ANALYSIS_CREDITS} credits.
              Nothing analyzes until you approve the shared plan.
            </p>
          </div>
        )}

        {Object.keys(failed).length > 0 && (
          <div role="alert" className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs">
            {Object.entries(failed).map(([name, msg]) => (
              <p key={name} className="text-destructive">
                <span className="font-semibold">{name}:</span> {msg}
              </p>
            ))}
            {Object.keys(failedAudits).length > 0 && (
              <button
                type="button"
                disabled={cleaning || busy}
                onClick={() => void handleCleanupFailed()}
                className="mt-2 rounded-full border border-destructive/40 px-3 py-1.5 font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              >
                {cleaning ? "Removing…" : `Remove ${Object.keys(failedAudits).length} failed draft${Object.keys(failedAudits).length === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {phase && <p role="status" className="text-xs text-muted-foreground">{phase}…</p>}

        <div className="flex items-center justify-between">
          {reviewing ? (
            <Button variant="ghost" disabled={busy} onClick={handleBack}>Start over</Button>
          ) : (
            <Button variant="ghost" disabled={busy} onClick={() => router.push("/dashboard")}>Cancel</Button>
          )}
          {!reviewing ? (
            <Button onClick={handlePrepare} disabled={files.length === 0 || busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Uploading…" : `Sort ${files.length === 0 ? "" : `${files.length} `}deal${files.length === 1 ? "" : "s"}`}
            </Button>
          ) : (
            <Button onClick={handleCreatePlan} disabled={rows.length === 0 || busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Creating plan…" : `Create plan for ${rows.length} deal${rows.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}
