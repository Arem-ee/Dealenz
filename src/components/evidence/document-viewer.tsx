// Document viewer modal (Phase 8).
//
// Renders the result of server-side source inspection: the located document
// with the matched quote highlighted, plus an honest status label. Exact
// spans highlight the verified offsets; approximate matches highlight the
// located quote inside a clearly labeled approximate banner; unavailable
// sources show the explanation and nothing else. No AI, no credits, no
// location ever invented client-side.

"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { inspectSourceEvidence, type InspectedSource } from "@/app/audit/[id]/evidence-actions"
import type { Evidence } from "@/lib/evidence/schema"

const EXCERPT_RADIUS = 600

function excerptAround(text: string, offset: number, length: number): { before: string; match: string; after: string } {
  const start = Math.max(0, offset - EXCERPT_RADIUS)
  const end = Math.min(text.length, offset + length + EXCERPT_RADIUS)
  return {
    before: (start > 0 ? "…" : "") + text.slice(start, offset),
    match: text.slice(offset, offset + length),
    after: text.slice(offset + length, end) + (end < text.length ? "…" : ""),
  }
}

export function DocumentViewerModal({
  auditId,
  evidence,
  onClose,
}: {
  auditId: string
  evidence: Evidence
  onClose: () => void
}) {
  const requestKey = `${auditId}:${evidence.id}`
  const [state, setState] = useState<{
    key: string
    result: InspectedSource | null
    error: string | null
  }>({ key: requestKey, result: null, error: null })

  useEffect(() => {
    let cancelled = false
    inspectSourceEvidence(auditId, evidence)
      .then((inspected) => {
        if (!cancelled) setState({ key: requestKey, result: inspected, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ key: requestKey, result: null, error: err instanceof Error ? err.message : "Could not open the source." })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  const { result, error } = state.key === requestKey ? state : { result: null, error: null }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Highlight length follows the located quote. For exact results this equals
  // the verified span; for approximate results it marks where the quote was
  // found (whitespace may differ by a few characters, hence the banner).
  const highlightLength = result?.quote ? Math.min(result.quote.length, 2000) : 0
  const view =
    result && result.matchOffset !== null && result.documentText && result.quote
      ? { text: result.documentText, offset: result.matchOffset }
      : null
  const excerpt = view ? excerptAround(view.text, view.offset, highlightLength) : null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Document source"
        className="relative w-full max-w-2xl rounded-xl border border-border bg-background p-5 shadow-lg"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Source document</h2>
            {result?.documentLabel && (
              <p className="mt-0.5 text-xs text-muted-foreground">{result.documentLabel}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {!result && !error && <p className="py-8 text-center text-sm text-muted-foreground">Opening source…</p>}
        {error && <p className="py-4 text-sm text-destructive">{error}</p>}

        {result && (
          <div className="space-y-3">
            <p
              className={
                result.status === "EXACT"
                  ? "inline-block rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success"
                  : result.status === "APPROXIMATE"
                    ? "inline-block rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-medium text-warning-foreground"
                    : "inline-block rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              }
            >
              {result.status === "EXACT"
                ? "Exact location"
                : result.status === "APPROXIMATE"
                  ? "Approximate location"
                  : "Source unavailable"}
            </p>

            {excerpt && view ? (
              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border/60 bg-muted/40 p-4 text-sm leading-relaxed">
                <p className="whitespace-pre-wrap">
                  {excerpt.before}
                  <mark className="rounded-sm bg-amber-200 px-0.5 text-inherit">
                    {view.text.slice(view.offset, view.offset + highlightLength)}
                  </mark>
                  {excerpt.after}
                </p>
              </div>
            ) : null}

            {result.quote && result.status !== "UNAVAILABLE" ? (
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Observed quote</p>
                <p className="mt-1 text-sm">“{result.quote}”</p>
              </div>
            ) : null}

            <p className="text-xs leading-relaxed text-muted-foreground">{result.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
