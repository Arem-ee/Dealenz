"use client"

import { useEffect, useState } from "react"
import { Check, ClipboardCheck, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import {
  decideApprovalRequest,
  listApprovalGroups,
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

function StepLine({ steps }: { steps: ApprovalRequestRow["steps"] }) {
  if (!steps || steps.length <= 1) return null
  const done = steps.filter((s) => s.verdict === "approved").length
  const live = steps.find((s) => s.verdict === "pending")
  return (
    <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
      Step {live ? steps.indexOf(live) + 1 : steps.length} of {steps.length}
      {live ? ` · awaiting ${live.route}` : ""}
      {done > 0 && ` · ${done} approved`}
    </p>
  )
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
  const [groups, setGroups] = useState<Array<{ groupId: string; name: string; orgId: string; members: number }>>([])
  const [planId, setPlanId] = useState("")
  const [legs, setLegs] = useState<Array<{ kind: "person" | "group"; id: string }>>([{ kind: "person", id: "" }])
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
      const [p, a, g] = await Promise.all([listRequestablePlans(), listApprovers(), listApprovalGroups()])
      if (p.ok) {
        setPlans(p.plans)
        if (p.plans.length > 0 && !planId) setPlanId(p.plans[0]!.id)
      } else {
        showError(p.error)
      }
      if (a.ok) {
        setApprovers(a.approvers)
        setLegs((prev) => prev.map((l) => (l.kind === "person" && !l.id && a.approvers.length > 0 ? { ...l, id: a.approvers[0]!.userId } : l)))
      } else {
        showError(a.error)
      }
      if (g.ok) {
        setGroups(g.groups)
        setLegs((prev) => prev.map((l) => (l.kind === "group" && !l.id && g.groups.length > 0 ? { ...l, id: g.groups[0]!.groupId } : l)))
      } else {
        showError(g.error)
      }
    } catch {
      // Request validates server-side; pickers are best-effort.
    }
  }

  async function file() {
    const clean = legs.filter((l) => l.id)
    if (busy || !planId || clean.length === 0) return
    setBusy(true)
    try {
      const res = await requestApprovalDecision({
        planId,
        legs: clean.map((l) => (l.kind === "person" ? { userId: l.id } : { groupId: l.id })),
      })
      if (!res.ok) throw new Error(res.error)
      showSuccess(clean.length > 1 ? `Routed through ${clean.length} steps.` : "Routed for decision.")
      setRequestOpen(false)
      setLegs([{ kind: "person", id: "" }])
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
      if ("advanced" in res && res.advanced) {
        showSuccess(`Step recorded — moved to step ${res.step + 1} of ${res.stepsTotal}.`)
      } else {
        showSuccess(verdict === "approved" ? "Approved." : "Rejected with reason.")
      }
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
          <p className="text-sm font-semibold">Route a plan through approvers</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Steps run in order — each approves before the next is asked. One person or one group per step, up to 5.
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
          <div className="mt-2 space-y-1.5" aria-label="Approval steps">
            {legs.map((leg, i) => (
              <div key={i} className="flex gap-1.5">
                <span className="flex h-9 w-14 shrink-0 items-center text-[11px] tabular-nums text-muted-foreground">Step {i + 1}</span>
                <div className="flex min-w-0 flex-1 gap-1.5">
                  {(["person", "group"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={leg.kind === k}
                      aria-label={`Step ${i + 1} route to ${k}`}
                      onClick={() => setLegs((prev) => prev.map((x, j) => (j === i ? { kind: k, id: "" } : x)))}
                      disabled={busy}
                      className={cn(
                        "h-9 shrink-0 border px-2 text-[11px] font-medium capitalize transition-colors disabled:opacity-50",
                        leg.kind === k
                          ? "border-foreground bg-muted font-semibold text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {k === "person" ? "Person" : "Group"}
                    </button>
                  ))}
                  {leg.kind === "person" ? (
                    <select
                      value={leg.id}
                      onChange={(e) => setLegs((prev) => prev.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))}
                      disabled={busy}
                      aria-label={`Step ${i + 1} approver`}
                      className="h-9 min-w-0 flex-1 border border-input bg-background px-2 text-xs disabled:opacity-60"
                    >
                      <option value="">Pick an approver…</option>
                      {approvers.map((a) => (
                        <option key={a.userId} value={a.userId}>{a.email || a.userId}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={leg.id}
                      onChange={(e) => setLegs((prev) => prev.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))}
                      disabled={busy}
                      aria-label={`Step ${i + 1} group`}
                      className="h-9 min-w-0 flex-1 border border-input bg-background px-2 text-xs disabled:opacity-60"
                    >
                      <option value="">Pick a group…</option>
                      {groups.map((g) => (
                        <option key={g.groupId} value={g.groupId}>{g.name} · {g.members} member{g.members === 1 ? "" : "s"}</option>
                      ))}
                    </select>
                  )}
                </div>
                {legs.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove step ${i + 1}`}
                    onClick={() => setLegs((prev) => prev.filter((_, j) => j !== i))}
                    disabled={busy}
                    className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {legs.length < 5 && (
              <button
                type="button"
                onClick={() => setLegs((prev) => [...prev, { kind: "person", id: "" }])}
                disabled={busy}
                className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                + Add another step
              </button>
            )}
          </div>
          {(approvers.length === 0 && groups.length === 0) && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              No approvers or groups — join an organization first (owners create groups in the Team tab).
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void file()}
              disabled={busy || !planId || legs.every((l) => !l.id)}
              className="inline-flex h-9 items-center bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy ? "Routing…" : legs.filter((l) => l.id).length > 1 ? `Route ${legs.filter((l) => l.id).length} steps` : "Route for decision"}
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
                    <p className="text-sm font-medium">
                      {r.title}
                      {r.covered_for && (
                        <span className="ml-2 border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Covering {r.covered_for}
                        </span>
                      )}
                    </p>
                    <StepLine steps={r.steps} />
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      from {r.requester_email || "a teammate"}{r.group_name ? ` · routed to ${r.group_name}` : ""} · {r.detail}
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
                      awaiting {r.group_name ? `${r.group_name} (any member)` : (r.approver_email || "your approver")} · {r.detail}
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
                      {r.requester_email || "teammate"} → {r.group_name ?? r.approver_email ?? "approver"} · frozen
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
