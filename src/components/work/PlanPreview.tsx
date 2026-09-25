"use client"

import { useState } from "react"
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
  // Double-submit guard: approvals mint fresh idempotency keys per click, so
  // a second tap while the first is in flight creates duplicate work.
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
          <button onClick={() => void run("approve", onApprove)} disabled={pending !== null} aria-label={pending === "approve" ? "Approving" : "Approve plan"} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {pending === "approve" ? "Approving…" : `Approve — ${plan.estimated_credits} credits`}
          </button>
          <button onClick={() => void run("reject", onReject)} disabled={pending !== null} className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">
            Reject / Edit
          </button>
        </div>
      )}
      {plan.status === "needs_input" && onResume && (
        <div className="mt-4 flex gap-2">
          <button onClick={() => void run("resume", onResume)} disabled={pending !== null} className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            {pending === "resume" ? "Resuming…" : "Resume — provide missing info and continue"}
          </button>
          <button onClick={() => void run("reject", onReject)} disabled={pending !== null} className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">
            Cancel
          </button>
        </div>
      )}
      {plan.status !== "awaiting_approval" && <div className="mt-3 text-xs text-muted-foreground">Payload hash: {plan.payload_hash.slice(0, 16)}…</div>}
    </div>
  )
}
