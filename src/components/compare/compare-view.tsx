"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Columns2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import {
  compareVersions,
  listComparables,
  type ComparableDoc,
  type CompareResult,
} from "@/app/(app)/compare/actions"

function docLabel(d: ComparableDoc): string {
  return `${d.dealTitle} · ${d.familyTitle} v${d.versionNumber}`
}

// Compare: two documents, every material difference. Pickers + line-level
// diff + summary render inline; no dialogs, no overlays.
export function CompareView() {
  const { showError } = useToast()
  const [docs, setDocs] = useState<ComparableDoc[] | null>(null)
  const [leftId, setLeftId] = useState("")
  const [rightId, setRightId] = useState("")
  const [result, setResult] = useState<CompareResult | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let live = true
    listComparables()
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          showError(res.error, "Compare failed to load")
          setDocs([])
          return
        }
        setDocs(res.docs)
        if (res.docs.length >= 2) {
          setLeftId(res.docs[0]!.id)
          setRightId(res.docs[1]!.id)
        }
      })
      .catch(() => {
        if (!live) return
        showError("Compare failed to load")
        setDocs([])
      })
    return () => {
      live = false
    }
  }, [showError])

  const canRun = useMemo(
    () => leftId !== "" && rightId !== "" && leftId !== rightId && !isPending,
    [leftId, rightId, isPending]
  )

  function run() {
    if (!canRun) return
    setResult(null)
    startTransition(async () => {
      try {
        const res = await compareVersions({ leftId, rightId })
        if (!res.ok) {
          showError(res.error, "Compare failed")
          return
        }
        const { left, right, lines, summary, findingDelta } = res
        setResult({ left, right, lines, summary, findingDelta })
      } catch {
        showError("Compare failed — please try again.")
      }
    })
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Compare</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Two documents, every material difference.
          </p>
        </div>
        <button
          type="button"
          disabled={!canRun}
          onClick={run}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Columns2 className="h-3.5 w-3.5" />}
          {isPending ? "Comparing." : "Compare"}
        </button>
      </div>

      {docs === null ? (
        <div className="border border-border px-4 py-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading documents.</p>
        </div>
      ) : docs.length < 2 ? (
        <div className="border border-dashed px-4 py-12 text-center">
          <Columns2 className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Need two documents</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Generate a second draft from Templates or the workspace, then compare.
          </p>
        </div>
      ) : (
        <div className="flex shrink-0 flex-col gap-px border border-border bg-border sm:flex-row" aria-label="Comparison slots">
          {(
            [
              { key: "left", value: leftId, set: setLeftId, label: "Left" },
              { key: "right", value: rightId, set: setRightId, label: "Right" },
            ] as const
          ).map((slot) => (
            <label key={slot.key} className="flex min-h-0 flex-1 flex-col gap-1 bg-background p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {slot.label}
              </span>
              <select
                value={slot.value}
                onChange={(e) => slot.set(e.target.value)}
                className="h-9 border border-border bg-background px-2 text-xs text-foreground"
                aria-label={`${slot.label} document`}
              >
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {docLabel(d)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {leftId === rightId && docs !== null && docs.length >= 2 ? (
        <p className="mt-2 text-xs text-muted-foreground">Pick two different documents.</p>
      ) : null}

      {result ? (
        <section className="mt-4 flex min-h-0 flex-1 flex-col" aria-label="Comparison result">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-border bg-background px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{result.summary.verdict}</p>
            <p className="text-xs text-muted-foreground">
              {result.summary.additions} added · {result.summary.deletions} removed ·{" "}
              {result.summary.unchanged} unchanged ({result.summary.changedPct}% changed)
            </p>
          </div>

          {result.findingDelta ? (
            <div className="mt-px border border-border bg-background px-4 py-3" aria-label="Finding changes">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Finding changes
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {result.findingDelta.resolved.length} resolved · {result.findingDelta.stillOpen.length} still
                open · {result.findingDelta.newIssues.length} new
              </p>
              {result.findingDelta.newIssues.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {result.findingDelta.newIssues.slice(0, 5).map((f) => (
                    <li key={f.ruleKey} className="border-l-2 border-[var(--destructive)] pl-2 text-xs text-foreground">
                      {f.summary}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="mt-px max-h-[60vh] overflow-y-auto border border-border bg-background" aria-label="Line diff">
            {result.lines.map((l, i) => (
              <div
                key={i}
                className={cn(
                  "border-l-2 px-3 py-0.5 font-mono text-[11px] leading-relaxed",
                  l.type === "add" && "border-green-700 bg-green-50 text-foreground",
                  l.type === "del" && "border-[var(--destructive)] bg-red-50 text-foreground",
                  l.type === "same" && "border-transparent text-muted-foreground"
                )}
              >
                <span className="mr-2 inline-block w-3 select-none text-muted-foreground" aria-hidden="true">
                  {l.type === "add" ? "+" : l.type === "del" ? "−" : " "}
                </span>
                {l.text === "" ? " " : l.text}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
