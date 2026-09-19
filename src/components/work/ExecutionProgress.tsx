"use client"

import type { PlanStepRow, WorkExecutionRow } from "@/lib/work/schema"
import { ClientTime } from "@/components/datetime"

export function ExecutionProgress({ execution, steps }: { execution: WorkExecutionRow | null; steps: PlanStepRow[] }) {
  if (!execution) return <div className="text-sm text-muted-foreground">No execution yet.</div>
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-semibold">Execution — {execution.status}</h3>
      <div className="mt-1 text-xs text-muted-foreground">Plan v{execution.plan_version} · Started {execution.started_at ? <ClientTime iso={execution.started_at} kind="datetime" /> : "—"}</div>
      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${s.status === "succeeded" ? "bg-green-500" : s.status === "failed" ? "bg-red-500" : s.status === "running" ? "bg-blue-500 animate-pulse" : s.status === "needs_input" ? "bg-amber-500" : "bg-muted"}`} />
            <span className="font-mono text-xs">{i + 1}.</span>
            <span className="font-medium">{s.operation}</span>
            <span className="text-xs text-muted-foreground">{s.status}</span>
            {s.error && <span className="text-xs text-red-600">{s.error}</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}
