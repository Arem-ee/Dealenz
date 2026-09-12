// Deal context panel (Phase 5B).
//
// Minimum UI to review detected context, confirm or correct it, and see what
// is still missing before analysis. Progressive disclosure: required fields
// and uncertain detections get correction controls; settled optional fields
// are display-only. Imports only pure domain modules (schema/requirements/
// gate) — never the inference or provider code.

"use client"

import { useState } from "react"
import { Check, Loader2, Pencil, ScanSearch, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { confirmContext, inferAndPersistContext } from "@/app/audit/[id]/context-actions"
import {
  ENTITY_TYPE_VALUES,
  INDUSTRY_VALUES,
  ROLE_VALUES,
  STAGE_VALUES,
  STRUCTURE_VALUES,
  type ContextEnvelope,
  type ContextFieldKey,
  type DealType,
} from "@/lib/context/schema"
import { CONFIRMATION_THRESHOLD, requiredContextFields } from "@/lib/context/requirements"
import { evaluateContextGate } from "@/lib/context/gate"

interface ContextPanelProps {
  auditId: string
  dealType: DealType
  initialEnvelope: ContextEnvelope | null
}

const FIELD_LABELS: Record<ContextFieldKey, string> = {
  dealType: "Deal type",
  jurisdiction: "Jurisdiction",
  governingLaw: "Governing law",
  userRole: "Your role",
  counterpartyRole: "Counterparty role",
  industry: "Industry",
  transactionStructure: "Deal structure",
  transactionValue: "Deal value",
  transactionCurrency: "Currency",
  transactionStage: "Stage",
  crossBorder: "Cross-border",
  regulatedIndustry: "Regulated industry",
  entityTypes: "Entity types",
}

const DISPLAY_ORDER: ContextFieldKey[] = [
  "dealType",
  "jurisdiction",
  "governingLaw",
  "userRole",
  "counterpartyRole",
  "industry",
  "transactionStructure",
  "transactionValue",
  "transactionCurrency",
  "transactionStage",
  "crossBorder",
  "regulatedIndustry",
  "entityTypes",
]

function formatValue(key: ContextFieldKey, value: unknown): string {
  if (value === null || value === undefined) return "Not detected yet"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "Not detected yet"
  if (typeof value === "number") return value.toLocaleString()
  return String(value).replaceAll("_", " ")
}

function enumOptions(key: ContextFieldKey): readonly string[] | null {
  switch (key) {
    case "userRole":
    case "counterpartyRole":
      return ROLE_VALUES
    case "industry":
      return INDUSTRY_VALUES
    case "transactionStructure":
      return STRUCTURE_VALUES
    case "transactionStage":
      return STAGE_VALUES
    default:
      return null
  }
}

export function ContextPanel({ auditId, dealType, initialEnvelope }: ContextPanelProps) {
  const [envelope, setEnvelope] = useState<ContextEnvelope | null>(initialEnvelope)
  const [busy, setBusy] = useState<"idle" | "detecting" | "confirming">("idle")
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ContextFieldKey | null>(null)
  const [draft, setDraft] = useState("")

  const required = requiredContextFields(dealType)
  const gate = evaluateContextGate(envelope, dealType)

  async function handleDetect() {
    setBusy("detecting")
    setError(null)
    try {
      const result = await inferAndPersistContext(auditId)
      if (result.success && result.envelope) {
        setEnvelope(result.envelope)
      } else {
        setError(result.error ?? "Could not detect context")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not detect context")
    } finally {
      setBusy("idle")
    }
  }

  async function handleConfirm(updates: Record<string, { value: unknown }>) {
    setBusy("confirming")
    setError(null)
    try {
      const result = await confirmContext(auditId, updates)
      if (result.success && result.envelope) {
        setEnvelope(result.envelope)
        setEditing(null)
      } else {
        setError(result.error ?? "Could not confirm context")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm context")
    } finally {
      setBusy("idle")
    }
  }

  function startEditing(key: ContextFieldKey) {
    const current = envelope?.fields[key].value
    setDraft(Array.isArray(current) ? current.join(", ") : (current === null || current === undefined ? "" : String(current)))
    setEditing(key)
  }

  function submitEditing(key: ContextFieldKey) {
    let value: unknown = draft.trim()
    if (key === "transactionValue") {
      const n = Number(draft.replace(/,/g, ""))
      if (!Number.isFinite(n) || n < 0) {
        setError("Enter a valid non-negative amount")
        return
      }
      value = n
    } else if (key === "transactionCurrency") {
      value = draft.trim().toUpperCase()
    } else if (key === "crossBorder" || key === "regulatedIndustry") {
      value = draft === "true" || draft === "yes" || draft === "1"
    } else if (key === "entityTypes") {
      value = draft.split(",").map((s) => s.trim().toLowerCase().replaceAll(" ", "_")).filter(Boolean)
    }
    void handleConfirm({ [key]: { value } })
  }

  const inferredConfirmable = envelope
    ? (Object.keys(envelope.fields) as ContextFieldKey[]).filter(
        (k) => envelope.fields[k].source === "inferred"
      )
    : []

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Deal context</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            What this deal is and where it operates. Confirmed context is required before analysis.
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
            gate.state === "READY" && "bg-success/10 text-success",
            gate.state === "NEEDS_CONFIRMATION" && "bg-warning/15 text-warning-foreground",
            gate.state === "MISSING_REQUIRED_CONTEXT" && "bg-muted text-muted-foreground"
          )}
        >
          {gate.state === "READY" && "Ready"}
          {gate.state === "NEEDS_CONFIRMATION" && "Needs confirmation"}
          {gate.state === "MISSING_REQUIRED_CONTEXT" && "Incomplete"}
        </span>
      </div>

      {gate.state !== "READY" && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{gate.detail}</p>
      )}

      <dl className="mt-4 space-y-2.5">
        {DISPLAY_ORDER.map((key) => {
          const field = envelope?.fields[key]
          const source = field?.source ?? "unknown"
          const isRequired = required.includes(key)
          const needsAttention =
            (isRequired && source !== "user_confirmed") ||
            (source === "inferred" && (field?.confidence ?? 0) < CONFIRMATION_THRESHOLD)
          if (source === "unknown" && !isRequired) return null
          return (
            <div key={key} className="flex items-center gap-2 text-sm">
              <dt className="w-36 shrink-0 text-xs text-muted-foreground">
                {FIELD_LABELS[key]}
                {isRequired && <span className="ml-1 text-primary">*</span>}
              </dt>
              <dd className="min-w-0 flex-1 truncate text-[13px]">
                {editing === key ? (
                  <span className="flex items-center gap-1.5">
                    {enumOptions(key) ? (
                      <select
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px]"
                      >
                        <option value="">Select…</option>
                        {enumOptions(key)!.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    ) : key === "crossBorder" || key === "regulatedIndustry" ? (
                      <select
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="h-8 rounded-md border border-border bg-background px-2 text-[13px]"
                      >
                        <option value="">Select…</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : key === "entityTypes" ? (
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={ENTITY_TYPE_VALUES.join(", ")}
                        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px]"
                      />
                    ) : (
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={key === "transactionCurrency" ? "USD" : "Type a correction…"}
                        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px]"
                      />
                    )}
                    <Button size="sm" disabled={busy !== "idle" || !draft.trim()} onClick={() => submitEditing(key)}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  formatValue(key, field?.value ?? null)
                )}
              </dd>
              {editing !== key && (
                <span className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      source === "user_confirmed" && "bg-success/10 text-success",
                      source === "inferred" && "bg-warning/15 text-warning-foreground",
                      source === "unknown" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {source === "user_confirmed" && "Confirmed"}
                    {source === "inferred" && "Detected"}
                    {source === "unknown" && "Needed"}
                  </span>
                  {(needsAttention || source !== "unknown") && (
                    <button
                      onClick={() => startEditing(key)}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                      Correct
                    </button>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </dl>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy !== "idle"} onClick={handleDetect}>
          {busy === "detecting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
          Detect from deal input
        </Button>
        {inferredConfirmable.length > 0 && (
          <Button
            size="sm"
            disabled={busy !== "idle"}
            onClick={() => {
              const updates: Record<string, { value: unknown }> = {}
              for (const k of inferredConfirmable) {
                updates[k] = { value: envelope!.fields[k].value }
              }
              void handleConfirm(updates)
            }}
          >
            {busy === "confirming" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Confirm detected values
          </Button>
        )}
      </div>
    </div>
  )
}
