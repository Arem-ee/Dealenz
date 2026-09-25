"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText, Loader2, CheckCircle2, HelpCircle } from "lucide-react"

interface ProvenanceInfo {
  source: "extracted" | "context" | "fact" | "inferred"
  confidence: number
  observationKey?: string
}

interface DocumentDraftCardProps {
  payload: Record<string, unknown>
  onGenerate?: (vars: Record<string, string>) => Promise<void>
}

function ProvenanceBadge({ source, confidence }: { source: "extracted" | "context" | "fact" | "inferred"; confidence: number }) {
  const config = {
    extracted: { label: "From deal", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
    context: { label: "From context", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
    fact: { label: "From fact", color: "bg-purple-100 text-purple-700", icon: CheckCircle2 },
    inferred: { label: "Inferred", color: "bg-amber-100 text-amber-700", icon: HelpCircle },
  }[source]

  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${config.color}`}>
      <Icon className="h-2.5 w-2.5" />
      <span className="capitalize">{config.label}</span>
      <span className="text-[10px] opacity-70">{(confidence * 100).toFixed(0)}%</span>
    </span>
  )
}

function VariableInputRow({ 
  key, 
  label, 
  value, 
  onChange, 
  provenance, 
  isMissing 
}: { 
  key: string
  label: string
  value: string
  onChange: (val: string) => void
  provenance?: { source: "extracted" | "context" | "fact" | "inferred"; confidence: number; observationKey?: string }
  isMissing?: boolean
}) {
  if (isMissing) {
    return (
      <div key={key} className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium flex-1">{label}</label>
          <ProvenanceBadge source="inferred" confidence={0} />
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
          className="h-8 rounded-md border border-dashed bg-amber-50 px-2 text-sm text-amber-900 placeholder-amber-500"
        />
      </div>
    )
  }

  const prov = provenance
  return (
    <div key={key} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium flex-1">{label}</label>
        {prov && <ProvenanceBadge source={prov.source} confidence={prov.confidence} />}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 rounded-md border bg-background px-2 text-sm ${
          prov?.source === "inferred" 
            ? "border-amber-200 bg-amber-50" 
            : prov?.source === "extracted" || prov?.source === "context" || prov?.source === "fact"
              ? "border-green-200 bg-green-50" 
              : ""
        }`}
      />
      {prov?.observationKey && (
        <p className="text-[11px] text-muted-foreground">From: {prov.observationKey}</p>
      )}
    </div>
  )
}

export function DocumentDraftCard({ payload, onGenerate }: DocumentDraftCardProps) {
  const title = (payload.title as string) ?? "Document draft"
  const preview = (payload.preview as string) ?? ""
  const auditId = payload.auditId as string | undefined
  const status = payload.status as string | undefined
  const threadId = (payload.threadId as string | undefined) ?? null
  const autoFilled = (payload.autoFilled as string[]) ?? []
  const provenance = (payload.provenance as Record<string, { source: "extracted" | "context" | "fact" | "inferred"; confidence: number; observationKey?: string }>) ?? {}
  const missingVars = (payload.missingVars as string[]) ?? []

  const [vars, setVars] = useState<Record<string, string>>((payload.vars as Record<string, string>) ?? {})
  const [generating, setGenerating] = useState(false)

  // Collect all variables that need input: missing + auto-filled (for review)
  const allVars = new Set<string>([
    ...Object.keys(payload.vars as Record<string, string> ?? {}),
    ...autoFilled,
    ...missingVars
  ])

  async function handleGenerate() {
    if (!onGenerate) return
    setGenerating(true)
    try {
      await onGenerate(vars)
    } finally {
      setGenerating(false)
    }
  }

  function handleVarChange(key: string, value: string) {
    setVars(s => ({ ...s, [key]: value }))
  }

  // If status is needs_input or we have missing vars, show the input form
  const needsInput = status === "needs_input" || missingVars.length > 0

  if (needsInput || allVars.size > 0) {
    const displayVars = Array.from(allVars).sort((a, b) => {
      // Sort: missing first, then inferred, then auto-filled
      const aMissing = missingVars.includes(a)
      const bMissing = missingVars.includes(b)
      if (aMissing !== bMissing) return aMissing ? -1 : 1
      const aProv = (payload.provenance as Record<string, { source: string }>)?.[a]?.source
      const bProv = (payload.provenance as Record<string, { source: string }>)?.[b]?.source
      const aInferred = aProv === "inferred"
      const bInferred = bProv === "inferred"
      if (aInferred !== bInferred) return aInferred ? -1 : 1
      return a.localeCompare(b)
    })

    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">{title}</p>
          {status && <span className="ml-auto text-xs text-muted-foreground">{status}</span>}
        </div>
      {preview && <p className="mt-2  text-xs leading-relaxed text-muted-foreground line-clamp-3 whitespace-pre-wrap">{preview.slice(0, 400)}</p>}
        
        {allVars.size > 0 && (
          <div className="mt-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              {missingVars.length > 0 ? `${missingVars.length} missing` : "Review variables"}
              {autoFilled.length > 0 && ` · ${autoFilled.length} auto-filled`}
            </p>
            <div className="space-y-2">
              {displayVars.map((k) => (
                <VariableInputRow
                  key={k}
                  label={k.replace(/_/g, " ")}
                  value={vars[k] ?? ""}
                  onChange={(val: string) => handleVarChange(k, val)}
                  provenance={provenance[k]}
                  isMissing={missingVars.includes(k)}
                />
              ))}
            </div>
            <Button size="sm" className="mt-3 w-full" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              {missingVars.length > 0 ? "Fill missing and generate" : "Confirm and generate"}
            </Button>
          </div>
        )}
        
        <div className="mt-3 flex gap-2">
          {auditId ? (
            <Button asChild size="sm">
              <Link href={threadId ? `/document/${auditId}?threadId=${threadId}` : `/document/${auditId}`}>Open full draft</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">Continue in your dashboard</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">{title}</p>
        {status && <span className="ml-auto text-xs text-muted-foreground">{status}</span>}
      </div>
      {preview && <p className="mt-2 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{preview.slice(0, 400)}</p>}
      <div className="mt-3 flex gap-2">
        {auditId ? (
          <Button asChild size="sm">
            <Link href={threadId ? `/document/${auditId}?threadId=${threadId}` : `/document/${auditId}`}>Open</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">Continue in your dashboard</Link>
          </Button>
        )}
      </div>
    </div>
  )
}