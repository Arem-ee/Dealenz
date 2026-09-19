"use client"

import { useState } from "react"
import Link from "next/link"
import { parseSpreadsheetCSV, validateRows, type ParsedRow } from "@/lib/spreadsheet/parse"
import { getBatchSummary } from "@/lib/work/batch"
import { Section } from "./Section"
import type { DocVersion } from "./types"
import type { PlanRow, PlanStepRow } from "@/lib/work/schema"

// Batch outreach over the real pipeline: CSV parses locally, the plan is
// created/approved/executed through the existing Server Actions, drafts land
// in document_versions, and sending goes through /api/gmail/send with
// server-side ownership checks. Nothing bulk happens without approval.
export function BatchWorkspace({ threadId, auditId, plan, steps, versions, onChanged }: {
  threadId: string
  auditId: string
  plan: PlanRow | null
  steps: PlanStepRow[]
  versions: DocVersion[]
  onChanged: () => void
}) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [sendNote, setSendNote] = useState<Record<string, string>>({})

  const isBatchPlan = plan?.objective_kind === "proposal_batch"
  const summary = rows ? getBatchSummary(rows) : null

  const pickFile = async (file: File | undefined) => {
    setParseError(null)
    setRows(null)
    if (!file) return
    if (file.size > 500 * 1024) {
      setParseError("That file is too large for a batch import (max 500 KB).")
      return
    }
    try {
      const text = await file.text()
      const parsed = parseSpreadsheetCSV(text)
      if (parsed.rows.length === 0) {
        setParseError("No rows found. The CSV needs a header row and at least one contact.")
        return
      }
      if (parsed.rows.length > 200) {
        setParseError("Too many rows. Batches are capped at 200 contacts.")
        return
      }
      setRows(validateRows(parsed.rows, [], `batch_preview_${Date.now().toString(36)}`, 1))
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Could not read that file.")
    }
  }

  const createPlan = async () => {
    setCreateError(null)
    if (!rows) return
    setCreating(true)
    try {
      const { createBatchWorkPlan } = await import("@/lib/work/actions")
      // Raw file text is transient by design, so the plan is rebuilt from a
      // minimal CSV regenerated from the validated rows previewed above.
      const csvText = toCsv(rows)
      const res = await createBatchWorkPlan({ conversationId: threadId, dealId: auditId, csvText, protectionObjective: "Batch outreach" })
      if (!res.ok) {
        setCreateError(res.error)
        return
      }
      setRows(null)
      onChanged()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Could not create batch plan.")
    } finally {
      setCreating(false)
    }
  }

  const draftSteps = steps.filter((s) => s.operation === "generate_draft")
  const contentByDraftId = new Map(versions.map((v) => [v.id, v.content ?? ""]))

  const sendRow = async (rowId: string, to: string, draftId: string) => {
    setSending(rowId)
    try {
      const body = (contentByDraftId.get(draftId) ?? "").slice(0, 4000)
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan?.id, planVersion: plan?.version ?? 1, rowId, to, subject: `Proposal for ${to}`, body }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        setSendNote((s) => ({ ...s, [rowId]: json?.error ?? "Send failed." }))
        return
      }
      setSendNote((s) => ({ ...s, [rowId]: "Sent." }))
      onChanged()
    } catch (e) {
      setSendNote((s) => ({ ...s, [rowId]: e instanceof Error ? e.message : "Send failed." }))
    } finally {
      setSending(null)
    }
  }

  return (
    <div>
      {!isBatchPlan && (
        <Section title="New batch" hint="Upload contacts. Nothing sends until a plan is approved and each row is sent individually.">
          <label className="block rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void pickFile(e.target.files?.[0])}
            />
            <span className="font-medium text-foreground">Choose a CSV file</span>
            <span className="mt-1 block">Headers like email, name, company. Max 200 rows.</span>
          </label>
          {parseError && <p className="mt-2 text-xs text-destructive">{parseError}</p>}
          {rows && summary && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">
                {summary.total} contacts · {summary.valid} ready · {summary.invalid} invalid{summary.needsInput > 0 ? ` · ${summary.needsInput} need input` : ""}
              </p>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {rows.slice(0, 30).map((r) => (
                  <div key={r.rowId} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs">
                    <span className="font-medium">{r.email || "Missing email"}</span>
                    {r.name && <span className="text-muted-foreground">{r.name}</span>}
                    <span className="ml-auto rounded-full border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{r.state}</span>
                  </div>
                ))}
              </div>
              {createError && <p className="mt-2 text-xs text-destructive">{createError}</p>}
              <button
                type="button"
                disabled={creating || summary.valid === 0}
                onClick={() => void createPlan()}
                className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Creating…" : `Create batch plan (${summary.valid} draft${summary.valid === 1 ? "" : "s"})`}
              </button>
            </div>
          )}
        </Section>
      )}
      {isBatchPlan && (
        <Section title="Rows and results" hint="Drafts generate on execution. Each row sends individually.">
          {draftSteps.length === 0 ? (
            <p className="text-xs text-muted-foreground">No draft steps yet. Approve and execute the plan above to generate them.</p>
          ) : (
            <div className="space-y-1.5">
              {draftSteps.map((s) => {
                const result = (s.result_ref ?? {}) as { draftId?: string; rowId?: string }
                const input = (s.input_ref ?? {}) as { row?: Record<string, string>; rowId?: string }
                const to = String(input.row?.email ?? input.row?.["recipient"] ?? "")
                const rowId = String(result.rowId ?? input.rowId ?? s.id)
                const note = sendNote[rowId]
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{to || "Missing email"}</p>
                      <p className="text-muted-foreground">
                        {s.status}
                        {result.draftId ? " · draft ready" : ""}
                        {note ? ` · ${note}` : ""}
                      </p>
                    </div>
                    {result.draftId && (
                      <Link href={`/document/${auditId}`} className="rounded-full border px-3 py-1 font-medium hover:bg-muted/60">
                        Draft
                      </Link>
                    )}
                    {result.draftId && to.includes("@") && (
                      <button
                        type="button"
                        disabled={sending === rowId}
                        onClick={() => void sendRow(rowId, to, result.draftId as string)}
                        className="rounded-full border px-3 py-1 font-medium hover:bg-muted/60 disabled:opacity-50"
                      >
                        {sending === rowId ? "Sending…" : "Send"}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      )}
    </div>
  )
}

function toCsv(rows: ParsedRow[]): string {
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r.raw))))
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r.raw[h] ?? "")).join(","))].join("\n")
}
