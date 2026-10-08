"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FolderDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import {
  approveBatchPlan,
  executeBatchPlan,
  getBatchApprovalId,
  getBatchRollup,
  listBatchDeals,
  listBatchPlans,
  previewBatchManifest,
  rejectBatchPlan,
  startBatch,
  type BatchDealOption,
  type BatchManifest,
  type BatchPlanSummary,
  type BatchRollup,
} from "@/app/(app)/reports/batch"

// Batch: the folder drop as a priced, gated operation. Pick deals → manifest
// with exact estimate → approve the spend → execute with per-file isolation
// → roll up per-file outcomes. Bounded workers, never autonomous agents.
export function BatchSection() {
  const { showError, showSuccess } = useToast()
  const [deals, setDeals] = useState<BatchDealOption[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [manifest, setManifest] = useState<BatchManifest | null>(null)
  const [active, setActive] = useState<{ planId: string; threadId: string; estimate: number } | null>(null)
  const [planStatus, setPlanStatus] = useState<string | null>(null)
  const [approvalId, setApprovalId] = useState<string | null>(null)
  const [rollup, setRollup] = useState<BatchRollup | null>(null)
  const [plans, setPlans] = useState<BatchPlanSummary[] | null>(null)
  const [openPlanId, setOpenPlanId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([listBatchDeals(), listBatchPlans()])
      .then(([d, p]) => {
        if (!live) return
        if (!d.ok) showError(d.error, "Batch failed to load")
        else setDeals(d.deals)
        if (!p.ok) showError(p.error, "Batch history failed to load")
        else setPlans(p.plans)
        if (!d.ok) setDeals([])
        if (!p.ok) setPlans([])
      })
      .catch(() => {
        if (!live) return
        showError("Batch failed to load")
        setDeals([])
        setPlans([])
      })
    return () => {
      live = false
    }
  }, [showError])

  useEffect(() => {
    if (picked.length === 0) return
    let live = true
    previewBatchManifest({ auditIds: picked })
      .then((res) => {
        if (!live) return
        setManifest(res.ok ? res.manifest : null)
        if (!res.ok) showError(res.error)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [picked, showError])

  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]
    if (next.length === 0) setManifest(null)
    setPicked(next)
  }

  async function handleStart() {
    if (busy || picked.length === 0) return
    setBusy(true)
    try {
      const res = await startBatch({ auditIds: picked })
      if (!res.ok) throw new Error(res.error)
      setActive({ planId: res.planId, threadId: res.batchThreadId, estimate: res.estimateCredits })
      setPlanStatus("awaiting_approval")
      setApprovalId(null)
      setRollup(null)
      showSuccess(`Batch planned — ${res.estimateCredits} credits reserved on approval.`)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Batch failed to start.")
    } finally {
      setBusy(false)
    }
  }

  async function handleApprove() {
    if (busy || !active) return
    setBusy(true)
    try {
      const res = await approveBatchPlan({ planId: active.planId })
      if (!res.ok) throw new Error(res.error)
      const seal = await getBatchApprovalId({ planId: active.planId })
      if (seal.ok) setApprovalId(seal.approvalId)
      setPlanStatus("approved")
    } catch (err) {
      showError(err instanceof Error ? err.message : "Approval failed.")
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    if (busy || !active) return
    setBusy(true)
    try {
      const res = await rejectBatchPlan({ planId: active.planId })
      if (!res.ok) throw new Error(res.error)
      setActive(null)
      setPlanStatus(null)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Rejection failed.")
    } finally {
      setBusy(false)
    }
  }

  async function handleExecute() {
    if (busy || !active || !approvalId) return
    setBusy(true)
    try {
      const res = await executeBatchPlan({ planId: active.planId, approvalId })
      if (!res.ok) throw new Error(res.error)
      setPlanStatus(res.status)
      const roll = await getBatchRollup({ planId: active.planId })
      if (roll.ok) setRollup(roll.rollup)
      else showError(roll.error)
      const p = await listBatchPlans()
      if (p.ok) setPlans(p.plans)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Execution failed.")
    } finally {
      setBusy(false)
    }
  }

  const openRollup = useCallback(
    async (planId: string) => {
      if (openPlanId === planId) {
        setOpenPlanId(null)
        return
      }
      setOpenPlanId(planId)
      try {
        const roll = await getBatchRollup({ planId })
        if (!roll.ok) throw new Error(roll.error)
        setRollup(roll.rollup)
      } catch (err) {
        showError(err instanceof Error ? err.message : "Rollup failed to load.")
      }
    },
    [openPlanId, showError]
  )

  return (
    <div className="mt-4 border border-border bg-background p-4" aria-label="Batch analysis">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Batch analysis</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Many contracts in, one plan out — manifest and exact price before anything runs.
          </p>
        </div>
        <FolderDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      {deals === null ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading deals…
        </p>
      ) : deals.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No deals with workspace threads yet — analyze a deal first, then batch it here.
        </p>
      ) : (
        <div className="mt-3">
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto" aria-label="Pick deals">
            {deals.map((d) => (
              <button
                key={d.auditId}
                type="button"
                aria-pressed={picked.includes(d.auditId)}
                onClick={() => toggle(d.auditId)}
                className={cn(
                  "border px-2.5 py-1 text-left text-xs transition-colors",
                  picked.includes(d.auditId)
                    ? "border-foreground bg-muted font-semibold text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {d.title}
              </button>
            ))}
          </div>

          {manifest && picked.length > 0 ? (
            <div className="mt-2 border border-border px-3 py-2" aria-label="Batch manifest">
              <p className="text-xs font-semibold">
                Manifest — {manifest.count} deal{manifest.count === 1 ? "" : "s"} · {manifest.estimateCredits} credits
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {manifest.typeMix.map((m) => `${m.dealType.replace("_", " ")} ×${m.count}`).join(" · ")}
                {" "}· {manifest.perFileCredits} credits per file · one failure never kills the batch
              </p>
              {!active ? (
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={busy || manifest.overLimit}
                  className="mt-2 h-8 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                >
                  Plan batch — {manifest.estimateCredits} credits
                </button>
              ) : null}
            </div>
          ) : null}

          {active ? (
            <div className="mt-2 border border-border px-3 py-2" aria-label="Active batch">
              <p className="text-xs">
                <span className="font-semibold">Batch {planStatus?.replace("_", " ")}</span>
                <span className="text-muted-foreground"> · {active.estimate} credits estimated</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {planStatus === "awaiting_approval" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleApprove()}
                      disabled={busy}
                      className="h-8 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                    >
                      Approve spend
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReject()}
                      disabled={busy}
                      className="h-8 border border-border px-3 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                ) : null}
                {planStatus === "approved" ? (
                  <button
                    type="button"
                    onClick={() => void handleExecute()}
                    disabled={busy || !approvalId}
                    className="h-8 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    Execute batch
                  </button>
                ) : null}
                {planStatus && !["awaiting_approval", "approved"].includes(planStatus) ? (
                  <Link
                    href={`/chat/${active.threadId}`}
                    className="inline-flex h-8 items-center border border-border px-3 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Open batch thread
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {rollup && openPlanId !== null ? (
        <RollupView rollup={rollup} />
      ) : plans !== null && plans.length > 0 ? (
        <div className="mt-3" aria-label="Recent batches">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent batches</p>
          <ul className="mt-1.5 space-y-1.5">
            {plans.map((p) => (
              <li key={p.planId} className="border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{p.objective}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {p.status.replace("_", " ")} · {p.stepsSucceeded}/{p.stepsTotal} done
                      {p.stepsFailed > 0 ? ` · ${p.stepsFailed} failed` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openRollup(p.planId)}
                    className="h-7 shrink-0 border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {openPlanId === p.planId ? "Hide" : "Rollup"}
                  </button>
                </div>
                {openPlanId === p.planId && rollup ? <RollupView rollup={rollup} /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function RollupView({ rollup }: { rollup: BatchRollup }) {
  return (
    <div className="mt-2 border-t border-border pt-2" aria-label="Batch rollup">
      <p className="text-xs font-semibold">
        Rollup — {rollup.status.replace("_", " ")}
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {rollup.items.map((item) => {
          const flagged = item.criticalFails > 0
          return (
            <li
              key={item.auditId || item.title}
              className={cn("border-l-2 pl-2", flagged ? "border-[var(--destructive)]" : "border-border")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {item.stepStatus.replace("_", " ")}
                    {item.criticalFails > 0 ? ` · ${item.criticalFails} critical` : ""}
                    {item.materialFails > 0 ? ` · ${item.materialFails} material` : ""}
                    {item.criticalFails === 0 && item.materialFails === 0 ? " · clear" : ""}
                  </p>
                  {flagged ? (
                    <p className="mt-0.5 text-[11px] text-destructive">
                      Paused for review — open the deal, resolve, then re-run.
                    </p>
                  ) : null}
                </div>
                {item.threadId ? (
                  <Link
                    href={`/chat/${item.threadId}`}
                    className="h-7 shrink-0 border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Open deal
                  </Link>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
