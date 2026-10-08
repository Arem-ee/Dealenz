"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Handshake, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import type { NegotiationStance } from "@/lib/negotiation/round"
import { getTrackedDeals } from "@/app/(app)/clauses/tracking"
import { listGuestGrants, listStagedUploads } from "@/lib/deals/guests"
import {
  decideRound,
  listRounds,
  postNegotiationComment,
  resolveNegotiationComment,
  startRound,
  type NegotiationCommentView,
  type NegotiationRoundView,
} from "@/app/(app)/negotiations/actions"

type RoundWithComments = NegotiationRoundView & { comments: NegotiationCommentView[] }

const STANCES: NegotiationStance[] = ["light", "balanced", "firm"]

const OUTCOME_TONE: Record<string, string> = {
  accept: "text-green-700",
  fallback: "text-foreground",
  escalate: "text-destructive",
  route: "text-muted-foreground",
}

interface ClauseDraft {
  clauseId: string
  title: string
  mode: "stands" | "counter" | "missing"
  counterText: string
}

// Negotiation rounds in the workspace: owner-attested counterparty positions
// evaluated through the four-outcome engine, counter-language drafted for
// fallback rungs, concessions logged per round. Dual comments keep strategy
// internal and counterparty-visible threads strictly separate.
export function NegotiationSection({ auditId }: { auditId: string }) {
  const { showError, showSuccess } = useToast()
  const [rounds, setRounds] = useState<RoundWithComments[] | null>(null)
  const [clauses, setClauses] = useState<ClauseDraft[] | null>(null)
  const [grants, setGrants] = useState<Array<{ id: string; email: string }>>([])
  const [showNew, setShowNew] = useState(false)
  const [stance, setStance] = useState<NegotiationStance>("balanced")
  const [grantId, setGrantId] = useState("")
  const [stagedId, setStagedId] = useState("")
  const [stagedFiles, setStagedFiles] = useState<Array<{ id: string; fileName: string }>>([])
  const [busy, setBusy] = useState(false)
  const [commentFor, setCommentFor] = useState<string | null>(null)
  const [commentChannel, setCommentChannel] = useState<"internal" | "external">("internal")
  const [commentBody, setCommentBody] = useState("")

  useEffect(() => {
    let live = true
    Promise.all([listRounds(auditId), getTrackedDeals(), listGuestGrants(auditId), listStagedUploads(auditId)])
      .then(([r, t, g, s]) => {
        if (!live) return
        if (!r.ok) showError(r.error, "Rounds failed to load")
        else setRounds(r.rounds)
        if (r.ok && t.ok) {
          const deal = t.deals.find((d) => d.auditId === auditId)
          setClauses(
            (deal?.clauses ?? []).map((c) => ({ clauseId: c.clauseId, title: c.title, mode: "stands" as const, counterText: "" }))
          )
        } else {
          if (!t.ok) showError(t.error, "Clauses failed to load")
          setClauses([])
        }
        if (g.ok) setGrants(g.grants.filter((x) => !x.revokedAt).map((x) => ({ id: x.id, email: x.email })))
        if (s.ok) setStagedFiles(s.uploads.filter((x) => x.status === "pending").map((x) => ({ id: x.id, fileName: x.fileName })))
        else setStagedFiles([])
        if (!r.ok) setRounds([])
      })
      .catch(() => {
        if (!live) return
        showError("Negotiation failed to load")
        setRounds([])
        setClauses([])
      })
    return () => {
      live = false
    }
  }, [auditId, showError])

  async function refresh() {
    const r = await listRounds(auditId)
    if (r.ok) setRounds(r.rounds)
  }

  async function handleStart() {
    if (busy || !clauses || clauses.length === 0) return
    setBusy(true)
    try {
      const res = await startRound({
        auditId,
        stance,
        grantId: grantId || null,
        stagedUploadId: stagedId || null,
        clauses: clauses.map((c) => ({ clauseId: c.clauseId, mode: c.mode, counterText: c.counterText })),
      })
      if (!res.ok) throw new Error(res.error)
      setShowNew(false)
      await refresh()
      showSuccess(`Round ${res.round.roundNo} evaluated — concessions logged.`)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Round failed to start.")
    } finally {
      setBusy(false)
    }
  }

  async function handleDecide(roundId: string, verdict: "accepted" | "withdrawn") {
    if (busy) return
    setBusy(true)
    try {
      const res = await decideRound({ roundId, verdict })
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Decision failed.")
    } finally {
      setBusy(false)
    }
  }

  async function handleComment(roundId: string | null) {
    if (busy || !commentBody.trim()) return
    setBusy(true)
    try {
      const res = await postNegotiationComment({ auditId, roundId, channel: commentChannel, body: commentBody })
      if (!res.ok) throw new Error(res.error)
      setCommentFor(null)
      setCommentBody("")
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Comment not posted.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-border p-3" aria-label="Negotiation rounds">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Handshake className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          Negotiation
        </p>
        <button
          type="button"
          onClick={() => setShowNew(!showNew)}
          className="h-7 border border-border px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {showNew ? "Close" : "New round"}
        </button>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Attest their wording per clause — outcomes follow your ladders, counter-language drafts itself.
      </p>

      {showNew && clauses !== null ? (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Stance</span>
            {STANCES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={stance === s}
                onClick={() => setStance(s)}
                className={cn(
                  "border px-2 py-1 text-[11px] font-medium capitalize transition-colors",
                  stance === s
                    ? "border-foreground bg-muted font-semibold text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
            {grants.length > 0 ? (
              <select
                value={grantId}
                onChange={(e) => setGrantId(e.target.value)}
                aria-label="Attribute to counterparty grant"
                className="h-7 border border-input bg-background px-1.5 text-[11px] outline-none"
              >
                <option value="">Owner round</option>
                {grants.map((g) => (
                  <option key={g.id} value={g.id}>
                    Via {g.email}
                  </option>
                ))}
              </select>
            ) : null}
            {stagedFiles.length > 0 ? (
              <select
                value={stagedId}
                onChange={(e) => setStagedId(e.target.value)}
                aria-label="Locate wording in staged file"
                className="h-7 border border-input bg-background px-1.5 text-[11px] outline-none"
              >
                <option value="">No staged file</option>
                {stagedFiles.map((s) => (
                  <option key={s.id} value={s.id}>
                    Locate in {s.fileName}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          {stagedId ? (
            <p className="text-[11px] text-muted-foreground">
              Blank counter fields auto-locate in the staged file (verified spans only).
            </p>
          ) : null}
          {clauses.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No tracked clauses on this deal yet.</p>
          ) : (
            clauses.map((c) => (
              <div key={c.clauseId} className="border border-border px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.title}</span>
                  {(["stands", "counter", "missing"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={c.mode === m}
                      onClick={() =>
                        setClauses((prev) => (prev ?? []).map((x) => (x.clauseId === c.clauseId ? { ...x, mode: m } : x)))
                      }
                      className={cn(
                        "h-6 border px-1.5 text-[10px] font-medium capitalize transition-colors",
                        c.mode === m
                          ? "border-foreground bg-muted text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m === "stands" ? "Stands" : m === "counter" ? "They propose" : "Missing"}
                    </button>
                  ))}
                </div>
                {c.mode === "counter" ? (
                  <textarea
                    value={c.counterText}
                    onChange={(e) =>
                      setClauses((prev) => (prev ?? []).map((x) => (x.clauseId === c.clauseId ? { ...x, counterText: e.target.value } : x)))
                    }
                    rows={2}
                    maxLength={4000}
                    placeholder="Paste their exact wording for this clause"
                    aria-label={`Counterparty wording for ${c.title}`}
                    className="mt-1.5 w-full border border-input bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/60"
                  />
                ) : null}
              </div>
            ))
          )}
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={busy || clauses.length === 0}
            className="h-8 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            Evaluate round
          </button>
        </div>
      ) : null}

      {rounds === null ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading rounds…
        </p>
      ) : rounds.length === 0 && !showNew ? (
        <p className="mt-2 text-[11px] text-muted-foreground">No rounds yet — open one to evaluate their redlines.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rounds.map((r) => (
            <li key={r.id} className="border border-border px-2.5 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold">
                  Round {r.roundNo} · <span className="capitalize font-normal text-muted-foreground">{r.stance}</span>
                  <span className="font-normal text-muted-foreground"> · {r.status}</span>
                </p>
                {r.status === "proposed" ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => void handleDecide(r.id, "accepted")}
                      disabled={busy}
                      className="h-6 border border-border px-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecide(r.id, "withdrawn")}
                      disabled={busy}
                      className="h-6 border border-border px-1.5 text-[10px] font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      Withdraw
                    </button>
                  </div>
                ) : null}
              </div>
              <ul className="mt-1 space-y-1">
                {r.positions.map((p) => (
                  <li key={p.clauseId} className="border-l-2 border-muted-foreground/30 pl-2">
                    <p className="text-[11px]">
                      <span className={cn("font-semibold capitalize", OUTCOME_TONE[p.outcome] ?? "text-muted-foreground")}>
                        {p.outcome}
                      </span>
                      {p.variant && p.variant !== "preferred" ? <span className="text-muted-foreground"> · rung {p.rung}</span> : null}
                      <span className="text-muted-foreground"> — {p.reasoning}</span>
                    </p>
                    {p.counterText ? (
                      <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{p.counterText}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {r.status === "accepted" ? (
                r.agreedVersionId ? (
                  <Link href="/signing" className="mt-1.5 inline-block text-[11px] text-muted-foreground underline-offset-2 hover:underline">
                    Agreed — send v{r.agreedVersionId.slice(0, 8)} to signing
                  </Link>
                ) : (
                  <Link href="/signing" className="mt-1.5 inline-block text-[11px] text-muted-foreground underline-offset-2 hover:underline">
                    Agreed — open Signing
                  </Link>
                )
              ) : null}
              <div className="mt-1.5 space-y-1" aria-label="Round comments">
                {r.comments.map((cmt) => (
                  <div key={cmt.id} className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-[11px] text-muted-foreground">
                      <span className={cn("font-semibold", cmt.channel === "internal" ? "text-foreground" : "")}>
                        [{cmt.channel === "internal" ? "Internal — never shared" : "Counterparty-visible"}]
                      </span>{" "}
                      {cmt.authorLabel ? <span className="font-medium">({cmt.authorLabel}) </span> : ""}
                      <span className={cmt.resolved ? "line-through" : ""}>{cmt.body}</span>
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void (async () => {
                        setBusy(true)
                        try {
                          const res = await resolveNegotiationComment({ commentId: cmt.id, resolved: !cmt.resolved })
                          if (!res.ok) throw new Error(res.error)
                          await refresh()
                        } catch (err) {
                          showError(err instanceof Error ? err.message : "Thread not updated.")
                        } finally {
                          setBusy(false)
                        }
                      })()}
                      className="h-6 shrink-0 border border-border px-1.5 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {cmt.resolved ? "Reopen" : "Resolve"}
                    </button>
                  </div>
                ))}
                {commentFor === r.id ? (
                  <div className="flex gap-1.5">
                    <select
                      value={commentChannel}
                      onChange={(e) => setCommentChannel(e.target.value as "internal" | "external")}
                      aria-label="Comment channel"
                      className="h-8 shrink-0 border border-input bg-background px-1.5 text-[11px] outline-none"
                    >
                      <option value="internal">Internal</option>
                      <option value="external">External</option>
                    </select>
                    <input
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      maxLength={2000}
                      placeholder={commentChannel === "internal" ? "Strategy — never shared" : "Visible to the counterparty"}
                      aria-label="Comment"
                      className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/60"
                    />
                    <button
                      type="button"
                      onClick={() => void handleComment(r.id)}
                      disabled={busy || !commentBody.trim()}
                      className="h-8 shrink-0 bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                    >
                      Post
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCommentFor(r.id)
                      setCommentBody("")
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Comment
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
