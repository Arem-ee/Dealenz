"use client"

import { useEffect, useState } from "react"
import type { PlanStepRow, WorkExecutionRow } from "@/lib/work/schema"
import { ClientTime } from "@/components/datetime"
import { hasStageSignal, type AnalysisStage } from "@/lib/analysis/stages"
import { useAnalysisStages } from "./use-analysis-stages"
import { friendlyOperation } from "@/lib/work/operation-labels"

export function AnalysisStagesList({ stages, title }: { stages: AnalysisStage[]; title?: string }) {
  return (
    <div>
      {title && <p className="text-sm font-semibold">{title}</p>}
      <ul className="mt-1.5 space-y-1" aria-label="Analysis progress" role="status">
        {stages.map((stage) => (
          <li key={stage.key} className="flex items-center gap-2 text-[13px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                stage.state === "done"
                  ? "bg-success"
                  : stage.state === "failed"
                    ? "bg-foreground"
                    : stage.state === "active"
                      ? "bg-foreground animate-pulse"
                      : "bg-muted"
              }`}
            />
            <span className={stage.state === "pending" ? "text-muted-foreground" : "text-foreground"}>{stage.label}</span>
            {stage.state === "failed" && <span className="text-xs text-foreground">failed</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function useElapsedSeconds(since: string | null, running: boolean): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running || !since) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running, since])
  if (!since) return null
  const start = new Date(since).getTime()
  if (Number.isNaN(start)) return null
  return Math.max(0, Math.floor((now - start) / 1000))
}

function formatElapsed(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}m ${s}s`
}

export function ExecutionProgress({ execution, steps, auditId }: { execution: WorkExecutionRow | null; steps: PlanStepRow[]; auditId?: string | null }) {
  const analysisRunning = steps.some((s) => s.operation === "document_analysis" && s.status === "running")
  const stages = useAnalysisStages(auditId, analysisRunning)
  const elapsed = useElapsedSeconds(execution?.started_at ?? null, execution?.status === "running")

  if (!execution) return <p className="text-sm text-muted-foreground">Nothing running yet.</p>
  const running = execution.status === "running"
  const failed = execution.status === "failed"
  const done = steps.length > 0 && steps.every((s) => s.status === "succeeded")
  const failedSteps = steps.filter((s) => s.status === "failed")

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {failed ? "Something went wrong" : done ? "Finished" : "Working on it"}
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {failed
          ? "This run stopped before finishing. You are only charged for work that actually ran — try again from the plan."
          : done
            ? "All steps finished. The results are in the work surface."
            : "Dealenz is working through the approved plan."}
        {elapsed !== null && running && <span className="tabular-nums"> · {formatElapsed(elapsed)}</span>}
      </p>
      <ol className="mt-3 space-y-1.5" role="status" aria-label="Run progress">
        {steps.map((s, i) => (
          <li key={s.id}>
            <span className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 shrink-0 rounded-full ${s.status === "succeeded" ? "bg-success" : s.status === "failed" ? "bg-foreground" : s.status === "running" ? "bg-foreground animate-pulse" : s.status === "needs_input" ? "bg-muted-foreground" : "bg-muted"}`} />
              <span className="text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
              <span>{friendlyOperation(s.operation)}</span>
              <span className="text-xs text-muted-foreground">
                {s.status === "succeeded" ? "done" : s.status === "failed" ? "failed" : s.status === "running" ? "in progress" : s.status === "needs_input" ? "needs you" : "waiting"}
              </span>
            </span>
            {s.operation === "document_analysis" && s.status === "running" && stages && hasStageSignal(stages) && (
              <div className="ml-6 mt-1.5">
                <AnalysisStagesList stages={stages} />
              </div>
            )}
          </li>
        ))}
      </ol>
      {failed && failedSteps.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
            What failed
          </summary>
          <ul className="mt-1 space-y-1">
            {failedSteps.map((s) => (
              <li key={s.id} className="text-xs text-muted-foreground">
                {friendlyOperation(s.operation)}{s.error ? `: ${s.error}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Started {execution.started_at ? <ClientTime iso={execution.started_at} kind="datetime" /> : "—"}
      </p>
    </div>
  )
}
