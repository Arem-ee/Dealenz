"use client"

import type { PlanRow, PlanStepRow } from "@/lib/work/schema"

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
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-semibold">Plan — {plan.objective_kind}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{plan.objective}</p>
      <div className="mt-3 text-xs text-muted-foreground">
        <span>Estimated cost: {plan.estimated_credits} credits · Version {plan.version} · {plan.status}</span>
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li key={s.id} className="flex gap-3 text-sm">
            <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
            <span className="font-medium">{s.operation}</span>
            <span className="text-muted-foreground">— {s.estimated_credits} cr · {s.status}</span>
          </li>
        ))}
      </ol>
      {assumptions && (
        <div className="mt-4 grid gap-2 text-xs">
          {assumptions.missing.length > 0 && <div><span className="font-semibold">Missing:</span> {assumptions.missing.join(", ")}</div>}
          {assumptions.inferred.length > 0 && <div><span className="font-semibold">Inferred:</span> {assumptions.inferred.join(", ")}</div>}
          {assumptions.known.length > 0 && <div><span className="font-semibold">Known:</span> {assumptions.known.join(", ")}</div>}
        </div>
      )}
      {plan.status === "awaiting_approval" && (
        <div className="mt-4 flex gap-2">
          <button onClick={() => onApprove(plan.id)} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            {`Approve — ${plan.estimated_credits} credits`}
          </button>
          <button onClick={() => onReject(plan.id)} className="rounded-md border px-4 py-2 text-sm">
            Reject / Edit
          </button>
        </div>
      )}
      {plan.status === "needs_input" && onResume && (
        <div className="mt-4 flex gap-2">
          <button onClick={() => onResume(plan.id)} className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white">
            Resume — provide missing info and continue
          </button>
          <button onClick={() => onReject(plan.id)} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      )}
      {plan.status !== "awaiting_approval" && <div className="mt-3 text-xs text-muted-foreground">Payload hash: {plan.payload_hash.slice(0, 16)}…</div>}
    </div>
  )
}
