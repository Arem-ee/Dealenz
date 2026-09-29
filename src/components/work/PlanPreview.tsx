"use client"

import { useState } from "react"
import type { PlanRow, PlanStepRow } from "@/lib/work/schema"
import { friendlyObjective, friendlyOperation } from "@/lib/work/operation-labels"

export function PlanPreview({
  plan,
  steps,
  assumptions,
  onApprove,
  onReject,
  onResume,
}: {
  plan: PlanRow
  steps: PlanStepRow[]
  assumptions?: { known: string[]; inferred: string[]; missing: string[] }
  onApprove: (planId: string) => Promise<void>
  onReject: (planId: string) => Promise<void>
  onResume?: (planId: string) => Promise<void>
}) {
  const [pending, setPending] = useState<"approve" | "reject" | "resume" | null>(null)
  async function run(kind: "approve" | "reject" | "resume", fn: (planId: string) => Promise<void>) {
    if (pending) return
    setPending(kind)
    try {
      await fn(plan.id)
    } finally {
      setPending(null)
    }
  }
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Plan</p>
      <h3 className="mt-1 text-[15px] font-semibold leading-snug">{friendlyObjective(plan.objective_kind)}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{plan.objective}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {plan.estimated_credits} credit{plan.estimated_credits === 1 ? "" : "s"} to run · nothing happens until you approve
      </p>
      <ol className="mt-3 space-y-1.5">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-baseline gap-2 text-sm">
            <span className="text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
            <span>{friendlyOperation(s.operation)}</span>
          </li>
        ))}
      </ol>
      {assumptions && (
        <div className="mt-3 space-y-1 text-xs">
          {assumptions.missing.length > 0 && <div><span className="font-semibold">Still need:</span> {assumptions.missing.join(", ")}</div>}
          {assumptions.inferred.length > 0 && <div className="text-muted-foreground"><span className="font-semibold">Assumed:</span> {assumptions.inferred.join(", ")}</div>}
          {assumptions.known.length > 0 && <div className="text-muted-foreground"><span className="font-semibold">Known:</span> {assumptions.known.join(", ")}</div>}
        </div>
      )}
      {plan.status === "awaiting_approval" && (
        <div className="mt-4 flex gap-2">
          <button onClick={() => void run("approve", onApprove)} disabled={pending !== null} aria-label={pending === "approve" ? "Approving" : "Approve plan"} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {pending === "approve" ? "Approving…" : `Approve — ${plan.estimated_credits} credits`}
          </button>
          <button onClick={() => void run("reject", onReject)} disabled={pending !== null} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50">
            Reject / Edit
          </button>
        </div>
      )}
      {plan.status === "approved" && (
        <div className="mt-4 flex gap-2">
          <button onClick={() => void run("approve", onApprove)} disabled={pending !== null} aria-label={pending === "approve" ? "Executing" : "Execute plan"} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {pending === "approve" ? "Executing…" : `Execute — ${plan.estimated_credits} credits`}
          </button>
          <button onClick={() => void run("reject", onReject)} disabled={pending !== null} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50">
            Reject / Edit
          </button>
        </div>
      )}
      {plan.status === "needs_input" && onResume && (
        <div className="mt-4 flex gap-2">
          <button onClick={() => void run("resume", onResume)} disabled={pending !== null} className="rounded-full bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            {pending === "resume" ? "Resuming…" : "Resume — provide missing info and continue"}
          </button>
          <button onClick={() => void run("reject", onReject)} disabled={pending !== null} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50">
            Cancel
          </button>
        </div>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
          Technical details
        </summary>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {plan.objective_kind} · v{plan.version} · {plan.status} · {plan.payload_hash.slice(0, 16)}…
        </p>
      </details>
    </div>
  )
}
