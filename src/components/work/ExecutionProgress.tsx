"use client"

import type { PlanStepRow, WorkExecutionRow } from "@/lib/work/schema"
import { ClientTime } from "@/components/datetime"
import { hasStageSignal, type AnalysisStage } from "@/lib/analysis/stages"
import { useAnalysisStages } from "./use-analysis-stages"

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
                  ? "bg-green-500"
                  : stage.state === "failed"
                    ? "bg-red-500"
                    : stage.state === "active"
                      ? "bg-blue-500 animate-pulse"
                      : "bg-muted"
              }`}
            />
            <span className={stage.state === "pending" ? "text-muted-foreground" : "text-foreground"}>{stage.label}</span>
            {stage.state === "failed" && <span className="text-xs text-red-600">failed</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ExecutionProgress({ execution, steps, auditId }: { execution: WorkExecutionRow | null; steps: PlanStepRow[]; auditId?: string | null }) {
  const analysisRunning = steps.some((s) => s.operation === "document_analysis" && s.status === "running")
  const stages = useAnalysisStages(auditId, analysisRunning)

  if (!execution) return <div className="text-sm text-muted-foreground">No execution yet.</div>
  return (
    <div>
      <h3 className="text-sm font-semibold">Execution — {execution.status}</h3>
      <div className="mt-1 text-xs text-muted-foreground">Plan v{execution.plan_version} · Started {execution.started_at ? <ClientTime iso={execution.started_at} kind="datetime" /> : "—"}</div>
      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li key={s.id}>
            <span className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${s.status === "succeeded" ? "bg-green-500" : s.status === "failed" ? "bg-red-500" : s.status === "running" ? "bg-blue-500 animate-pulse" : s.status === "needs_input" ? "bg-amber-500" : "bg-muted"}`} />
              <span className="font-mono text-xs">{i + 1}.</span>
              <span className="font-medium">{s.operation}</span>
              <span className="text-xs text-muted-foreground">{s.status}</span>
              {s.error && <span className="text-xs text-red-600">{s.error}</span>}
            </span>
            {s.operation === "document_analysis" && s.status === "running" && stages && hasStageSignal(stages) && (
              <div className="ml-6 mt-1.5">
                <AnalysisStagesList stages={stages} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
