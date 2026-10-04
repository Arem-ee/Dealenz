"use client"

import { useEffect, useState } from "react"
import { Check, ClipboardCheck, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import {
  decideApprovalRequest,
  listApprovalQueue,
  listApprovers,
  listRequestablePlans,
  requestApprovalDecision,
  type ApprovalRequestRow,
} from "@/lib/approvals/actions"

type Filter = "all" | "pending" | "decided"

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "decided", label: "Decided" },
]

function verdictLabel(v: ApprovalRequestRow["verdict"]): string {
  if (v === "approved") return "Approved"
  if (v === "rejected") return "Rejected"
  return "Pending"
}

// Approvals queue: route a batch plan to an Owner/Admin of a shared org,
// decide with a frozen audit row (rejections carry a reason), and execute
// on a live approved verdict through the same version/hash seal as
// self-approval. Solo users never touch this tab — self-approval works
// exactly as before.
export function ApprovalsView() {
  const { showError, showSuccess } = useToast()
  const [filter, setFilter] = useState<Filter>("all")
  const [incoming, setIncoming] = useState<ApprovalRequestRow[] | null>(null)
  const [outgoing, setOutgoing] = useState<ApprovalRequestRow[] | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [plans, setPlans] = useState<Array<{ id: string; objective: string; estimated_credits: number; version: number; status: string; conversation_id: string | null }>>([])
  const [approvers, setApprovers] = useState<Array<{ userId: string; email: string; orgId: string }>>([])
  const [planId, setPlanId] = useState("")
  const [approverId, setApproverId] = useState("")
  const [busy, setBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [rejectFor, setRejectFor] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState("")

  const refresh = async () => {
    try {
      const res = await listApprovalQueue()
      if (!res.ok) {
        showError(res.error, "Approvals failed to load")
        setIncoming([])
        setOutgoing([])
        return
      }
      setIncoming(res.incoming)
      setOutgoing(res.outgoing)
    } catch {
      showError("Approvals failed to load")
      setIncoming([])
      setOutgoing([])
    }
  }

  useEffect(() => {
    let live = true
    listApprovalQueue()
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          showError(res.error, "Approvals failed to load")
          setIncoming([])
          setOutgoing([])
          return
        }
        setIncoming(res.incoming)
        setOutgoing(res.outgoing)
      })
      .catch(() => {
        if (!live) return
        showError("Approvals failed to load")
        setIncoming([])
        setOutgoing([])
      })
    return () => {
      live = false
    }
  }, [showError])

  async function openRequest() {
    setRequestOpen(true)
    try {
      const [p, a] = await Promise.all([listRequestablePlans(), listApprovers()])
      if (p.ok) {
        setPlans(p.plans)
        if (p.plans.length > 0 && !planId) setPlanId(p.plans[0]!.id)
      } else {
        showError(p.error)
      }
      if (a.ok) {
        setApprovers(a.approvers)
        if (a.approvers.length > 0 && !approverId) setApproverId(a.approvers[0]!.userId)
      } else {
        showError(a.error)
      }
    } catch {
      // Request validates server-side; pickers are best-effort.
    }
  }

  async function file() {
    if (busy || !planId || !approverId) return
    setBusy(true)
    try {
      const res = await requestApprovalDecision({ planId, approverUserId: approverId })
      if (!res.ok) throw new Error(res.error)
      showSuccess("Routed for decision.")
      setRequestOpen(false)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't file that request.")
    } finally {
      setBusy(false)
    }
  }

  async function decide(id: string, verdict: "approved" | "rejected") {
    if (rowBusy) return
    if (verdict === "rejected" && !rejectComment.trim()) {
      showError("A rejection needs a reason — the requester must know what to fix.")
      return
    }
    setRowBusy(id)
    try {
      const res = await decideApprovalRequest({ requestId: id, verdict, comment: rejectComment })
      if (!res.ok) throw new Error(res.error)
      showSuccess(verdict === "approved" ? "Approved." : "Rejected with reason.")
      setRejectFor(null)
      setRejectComment("")
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't record that decision.")
    } finally {
      setRowBusy(null)
    }
  }

  const loading = incoming === null || outgoing === null
  const pendingIncoming = (incoming ?? []).filter((r) => r.verdict === "pending")
  const decidedAll = [...(incoming ?? []), ...(outgoing ?? [])].filter((r) => r.verdict !== "pending")
  const pendingOutgoing = (outgoing ?? []).filter((r) => r.verdict === "pending")

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Approvals</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Nothing consequential runs without a decision.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openRequest()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Request approval
        </button>
      </div>

      {requestOpen && (
        <div className="mb-4 border border-border bg-background p-4" aria-label="Request approval">
          <p className="text-sm font-semibold">Route a plan to an approver</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Approvers are owners and admins of organizations you belong to. One live request per plan.
          </p>
          <label className="mt-2 block text-[11px] font-medium text-muted-foreground" htmlFor="approval-plan">Batch plan</label>
          <select
            id="approval-plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            disabled={busy}
            className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm disabled:opacity-60"
          >
            <option value="">Pick a plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.objective.slice(0, 60)} · {p.estimated_credits} credits · v{p.version} · {p.status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <label className="mt-2 block text-[11px] font-medium text-muted-foreground" htmlFor="approval-approver">Approver</label>
          <select
            id="approval-approver"
            value={approverId}
            onChange={(e) => setApproverId(e.target.value)}
            disabled={busy}
            className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm disabled:opacity-60"
          >
            <option value="">Pick an approver…</option>
            {approvers.map((a) => (
              <option key={a.userId} value={a.userId}>{a.email || a.userId}</option>
            ))}
          </select>
          {approvers.length === 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              No eligible approvers — join an organization with an owner or admin first.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void file()}
              disabled={busy || !planId || !approverId}
              className="inline-flex h-9 items-center bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy ? "Routing…" : "Route for decision"}
            </button>
            <button
              type="button"
              onClick={() => setRequestOpen(false)}
              className="inline-flex h-9 items-center px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-4" aria-label="Filter decisions">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "border px-2.5 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-foreground bg-muted font-semibold text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading decisions…</p>
      ) : (
        <div className="space-y-4">
          {(filter === "all" || filter === "pending") && pendingIncoming.length > 0 && (
            <section aria-label="Needs your decision">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Needs your decision</p>
              <ul className="mt-1.5 space-y-1.5">
                {pendingIncoming.map((r) => (
                  <li key={r.id} className="border border-border bg-background px-3.5 py-3">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      from {r.requester_email || "a teammate"} · {r.detail}
                    </p>
                    {rejectFor === r.id ? (
                      <div className="mt-2">
                        <label className="block text-[11px] font-medium text-muted-foreground" htmlFor={`reject-${r.id}`}>
                          Reason (required)
                        </label>
                        <input
                          id={`reject-${r.id}`}
                          value={rejectComment}
                          onChange={(e) => setRejectComment(e.target.value)}
                          disabled={rowBusy !== null}
                          autoComplete="off"
                          placeholder="What must change before this can run?"
                          className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm outline-none disabled:opacity-60"
                        />
                        <div className="mt-1.5 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void decide(r.id, "rejected")}
                            disabled={rowBusy !== null || !rejectComment.trim()}
                            className="inline-flex h-8 items-center bg-destructive px-3 text-[11px] font-semibold text-destructive-foreground disabled:opacity-40"
                          >
                            Reject with reason
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRejectFor(null); setRejectComment("") }}
                            className="inline-flex h-8 items-center px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void decide(r.id, "approved")}
                          disabled={rowBusy !== null}
                          className="inline-flex h-8 items-center gap-1 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejectFor(r.id); setRejectComment("") }}
                          disabled={rowBusy !== null}
                          className="inline-flex h-8 items-center gap-1 border border-border px-3 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(filter === "all" || filter === "pending") && pendingOutgoing.length > 0 && (
            <section aria-label="Your pending requests">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your pending requests</p>
              <ul className="mt-1.5 space-y-1.5">
                {pendingOutgoing.map((r) => (
                  <li key={r.id} className="border border-border bg-background px-3.5 py-3">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      awaiting {r.approver_email || "your approver"} · {r.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(filter === "all" || filter === "decided") && decidedAll.length > 0 && (
            <section aria-label="Decided">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Decided</p>
              <ul className="mt-1.5 space-y-1.5">
                {decidedAll.map((r) => (
                  <li key={r.id} className="border border-border bg-background px-3.5 py-3">
                    <p className="text-sm font-medium">
                      {r.title}
                      <span className={cn("ml-2 text-[11px] font-semibold", r.verdict === "approved" ? "text-pine-700" : "text-destructive")}>
                        {verdictLabel(r.verdict)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.requester_email || "teammate"} → {r.approver_email || "approver"} · frozen
                      at plan v{r.plan_version ?? "?"}{r.comment ? ` · “${r.comment}”` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pendingIncoming.length === 0 && pendingOutgoing.length === 0 && decidedAll.length === 0 && (
            <div className="border border-dashed px-4 py-12 text-center">
              <ClipboardCheck className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Nothing awaiting decision</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Route a batch plan to an approver, or decide for your teammates. Solo plans still approve themselves in the workspace.
              </p>
            </div>
          )}
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Approved team plans execute from the workspace on the frozen version — edit the plan and the verdict lapses.
      </p>
    </div>
  )
}
