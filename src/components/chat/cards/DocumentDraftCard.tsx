"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText, Loader2 } from "lucide-react"

export function DocumentDraftCard({ payload, onGenerate }: { payload: Record<string, unknown>; onGenerate?: (vars: Record<string, string>) => Promise<void> }) {
  const title = (payload.title as string) ?? "Document draft"
  const preview = (payload.preview as string) ?? ""
  const auditId = payload.auditId as string | undefined
  const status = payload.status as string | undefined
  const [vars, setVars] = useState<Record<string, string>>((payload.vars as Record<string, string>) ?? {})
  const [generating, setGenerating] = useState(false)

  const needsVars = Array.isArray(payload.missingVars) && (payload.missingVars as string[]).length > 0
  const missingVars = (payload.missingVars as string[]) ?? []

  async function handleGenerate() {
    if (!onGenerate) return
    setGenerating(true)
    try {
      await onGenerate(vars)
    } finally {
      setGenerating(false)
    }
  }

  if (payload.status === "needs_input") {
    return (
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">Need a few details</p>
        <p className="text-xs text-muted-foreground mt-1">For this document we need: {missingVars.join(", ")}</p>
        <div className="mt-3 space-y-2">
          {missingVars.map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="text-xs font-medium">{k}</label>
              <input
                value={vars[k] ?? ""}
                onChange={(e) => setVars((s) => ({ ...s, [k]: e.target.value }))}
                placeholder={`Enter ${k}`}
                className="h-8 rounded-md border bg-background px-2 text-sm"
              />
            </div>
          ))}
        </div>
        <Button size="sm" className="mt-3" onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
          Confirm and generate
        </Button>
      </div>
    )
  }

  const threadId = (payload.threadId as string | undefined) ?? null
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
          <span className="text-xs text-muted-foreground">Open in document view</span>
        )}
      </div>
    </div>
  )
}
