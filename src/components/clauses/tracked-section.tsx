"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Copy, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import type { ClauseUserState } from "@/lib/library/entries"
import { listApprovalGroups, listApprovers, requestEscalationDecision } from "@/lib/approvals/actions"
import {
  clearClauseState,
  getTrackedDeals,
  setClauseState,
  type DealClauseStateWithUser,
} from "@/app/(app)/clauses/tracking"

const STATUS_TONE: Record<string, string> = {
  suggested: "text-muted-foreground",
  draft: "text-foreground",
  needs_input: "text-destructive",
  signed: "text-green-700",
}

function statusLabel(status: string): string {
  if (status === "needs_input") return "Needs input"
  if (status === "suggested") return "Suggested"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// Tracked: every clause suggested or used in every deal, with its derived
// state. User actions (accept / edit / dismiss) annotate — derived truth is
// never rewritten, and clearing an action reverts to it.
export function TrackedSection({ dealTypeFilter }: { dealTypeFilter: string }) {
  const { showError } = useToast()
  const [deals, setDeals] = useState<DealClauseStateWithUser[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [escalateFor, setEscalateFor] = useState<string | null>(null)
  const [approvers, setApprovers] = useState<Array<{ userId: string; email: string }>>([])
  const [groups, setGroups] = useState<Array<{ groupId: string; name: string }>>([])
  const [escTarget, setEscTarget] = useState("")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    getTrackedDeals()
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          showError(res.error, "Tracking failed to load")
          setDeals([])
          return
        }
        setDeals(res.deals)
      })
      .catch(() => {
        if (!live) return
        showError("Tracking failed to load")
        setDeals([])
      })
    return () => {
      live = false
    }
  }, [showError])

  const visible = useMemo(() => {
    const list = (deals ?? []).filter((d) => d.clauses.length > 0)
    if (dealTypeFilter === "All") return list
    return list.filter((d) => d.dealType.replace("_", " ").toLowerCase() === dealTypeFilter.toLowerCase())
  }, [deals, dealTypeFilter])

  async function act(auditId: string, clauseId: string, status: ClauseUserState, noteText?: string) {
    if (busy) return
    setBusy(`${auditId}:${clauseId}`)
    try {
      const res = await setClauseState({ auditId, clauseId, status, note: noteText ?? "" })
      if (!res.ok) throw new Error(res.error)
      setDeals((prev) =>
        (prev ?? []).map((d) =>
          d.auditId !== auditId
            ? d
            : {
                ...d,
                clauses: d.clauses.map((c) =>
                  c.clauseId !== clauseId ? c : { ...c, userState: status, userNote: (noteText ?? "").trim().slice(0, 500) }
                ),
              }
        )
      )
      setNoteFor(null)
      setNote("")
    } catch (err) {
      showError(err instanceof Error ? err.message : "Action not saved.")
    } finally {
      setBusy(null)
    }
  }

  async function openEscalate() {
    try {
      const [a, g] = await Promise.all([listApprovers(), listApprovalGroups()])
      if (a.ok) setApprovers(a.approvers)
      if (g.ok) setGroups(g.groups.map((x) => ({ groupId: x.groupId, name: x.name })))
    } catch {
      // Approver lists are best-effort; the form still sends by id.
    }
  }

  async function sendEscalation(auditId: string, clauseId: string, clauseTitle: string) {
    if (busy || !escTarget) return
    setBusy(`${auditId}:${clauseId}:esc`)
    try {
      const [kind, id] = escTarget.split(":", 2)
      const deal = (deals ?? []).find((d) => d.auditId === auditId)
      const clause = deal?.clauses.find((c) => c.clauseId === clauseId)
      const rung = clause?.pairing.find((p) => p.escalate)
      const res = await requestEscalationDecision({
        auditId,
        clauseTitle,
        positionText: rung?.positionText ?? clause?.pairing[0]?.positionText ?? "",
        rungLabel: rung ? `${rung.variant} rung ${rung.rung}` : "ladder exhausted",
        ...(kind === "user" ? { approverUserId: id } : { approverGroupId: id }),
      })
      if (!res.ok) throw new Error(res.error)
      setEscalateFor(null)
      setEscTarget("")
      const refreshed = await getTrackedDeals()
      if (refreshed.ok) setDeals(refreshed.deals)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Escalation failed.")
    } finally {
      setBusy(null)
    }
  }

  async function copyInsertion(key: string, body: string) {
    try {
      await navigator.clipboard.writeText(body)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2000)
    } catch {
      showError("Copy failed — select the text manually.")
    }
  }

  async function reopen(auditId: string, clauseId: string) {
    if (busy) return
    setBusy(`${auditId}:${clauseId}`)
    try {
      const res = await clearClauseState({ auditId, clauseId })
      if (!res.ok) throw new Error(res.error)
      setDeals((prev) =>
        (prev ?? []).map((d) =>
          d.auditId !== auditId
            ? d
            : {
                ...d,
                clauses: d.clauses.map((c) =>
                  c.clauseId !== clauseId ? c : { ...c, userState: null, userNote: "" }
                ),
              }
        )
      )
    } catch (err) {
      showError(err instanceof Error ? err.message : "Action not cleared.")
    } finally {
      setBusy(null)
    }
  }

  if (deals === null) {
    return (
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading tracked clauses…
      </p>
    )
  }

  if (visible.length === 0) {
    return (
      <div className="mt-2 border border-dashed px-4 py-10 text-center">
        <p className="text-sm font-medium">Nothing tracked yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Clauses move through Suggested → In draft → Needs input → Signed as deals progress.
        </p>
      </div>
    )
  }

  return (
    <ul className="mt-2 space-y-3">
      {visible.map((d) => (
        <li key={d.auditId} className="border border-border px-3 py-2.5">
          <p className="text-[13px] font-semibold">{d.title}</p>
          <ul className="mt-1.5 space-y-1.5">
            {d.clauses.map((c) => {
              const key = `${d.auditId}:${c.clauseId}`
              const dismissed = c.userState === "dismissed"
              return (
                <li
                  key={c.clauseId}
                  className={cn("border-l-2 pl-2", dismissed ? "border-border opacity-60" : "border-muted-foreground/30")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">
                        {c.title}{" "}
                        <span className={cn("font-normal", STATUS_TONE[c.status] ?? "text-muted-foreground")}>
                          · {statusLabel(c.status)}
                        </span>
                        {c.familyTitle ? <span className="font-normal text-muted-foreground"> · {c.familyTitle}{c.versionNumber ? ` v${c.versionNumber}` : ""}</span> : null}
                      </p>
                      {c.missingVariables.length > 0 ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Missing: {c.missingVariables.join(", ")}
                        </p>
                      ) : null}
                      {c.userState ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          You {c.userState}
                          {c.userNote ? ` — ${c.userNote}` : ""}
                        </p>
                      ) : null}
                      {c.escalated ? (
                        <p className="mt-0.5 text-[11px] font-medium text-foreground">
                          Escalated — awaiting a decision in Approvals.
                        </p>
                      ) : null}
                      {c.pairing.length > 0 ? (
                        <div className="mt-1 border-t border-border/60 pt-1" aria-label="Linked playbook language">
                          {c.pairing.map((p) => (
                            <p key={p.linkId} className="mt-0.5 text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                {p.variant === "preferred" ? "Enforced" : p.variant === "fallback" ? `Fallback ${p.rung}` : "Walk-away"}
                              </span>
                              {" "}by “{p.positionText}” · {p.languageTitle} v{p.languageVersion}
                              {p.conditionText ? ` — offer when: ${p.conditionText}` : ""}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!c.userState ? (
                        <>
                          <button
                            type="button"
                            disabled={busy === key}
                            onClick={() => void act(d.auditId, c.clauseId, "accepted")}
                            className="h-7 border border-border px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={busy === key}
                            onClick={() => {
                              setNoteFor(key)
                              setNote("")
                            }}
                            className="h-7 border border-border px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy === key}
                            onClick={() => void act(d.auditId, c.clauseId, "dismissed")}
                            className="h-7 border border-border px-2 text-[11px] font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === key}
                          onClick={() => void reopen(d.auditId, c.clauseId)}
                          className="h-7 border border-border px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                      {!c.escalated && c.pairing.some((p) => p.escalate) ? (
                        <button
                          type="button"
                          disabled={busy === `${key}:esc`}
                          onClick={() => {
                            setEscalateFor(key)
                            setEscTarget("")
                            void openEscalate()
                          }}
                          className="h-7 border border-border px-2 text-[11px] font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
                        >
                          Escalate
                        </button>
                      ) : null}
                      {(c.status === "suggested" || c.status === "needs_input") &&
                      c.pairing.some((p) => p.insertOnMissing && p.variant === "preferred") ? (
                        <button
                          type="button"
                          onClick={() => {
                            const pref = c.pairing.find((p) => p.insertOnMissing && p.variant === "preferred")!
                            void copyInsertion(key, pref.languageBody)
                          }}
                          className="flex h-7 items-center gap-1 border border-border px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          {copiedKey === key ? (
                            <Check className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          )}
                          {copiedKey === key ? "Copied" : "Copy insertion"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {escalateFor === key ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <select
                        value={escTarget}
                        onChange={(e) => setEscTarget(e.target.value)}
                        aria-label="Route escalation to"
                        className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none"
                      >
                        <option value="">Route to…</option>
                        {approvers.map((a) => (
                          <option key={a.userId} value={`user:${a.userId}`}>
                            {a.email || "Approver"}
                          </option>
                        ))}
                        {groups.map((g) => (
                          <option key={g.groupId} value={`group:${g.groupId}`}>
                            {g.name} (group)
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy === `${key}:esc` || !escTarget}
                        onClick={() => void sendEscalation(d.auditId, c.clauseId, c.title)}
                        className="h-8 shrink-0 bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                      >
                        Send
                      </button>
                    </div>
                  ) : null}
                  {noteFor === key ? (
                    <div className="mt-1.5 flex gap-1.5">
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={500}
                        placeholder="What did you change?"
                        aria-label="Edit note"
                        className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/60"
                      />
                      <button
                        type="button"
                        disabled={busy === key || !note.trim()}
                        onClick={() => void act(d.auditId, c.clauseId, "edited", note)}
                        className="h-8 shrink-0 bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                      >
                        Save
                      </button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}
