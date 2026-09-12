import { redirect, notFound } from "next/navigation"
import { renderMarkdown } from "@/lib/markdown"
import { getAssignedReview, getReviewActivity, getReviewServiceOrders } from "../../actions"
import { deriveAttention } from "@/lib/review/attention"
import { ReviewLifecycleButtons } from "@/components/lawyer/review-actions"
import { CommentThread, type ThreadComment } from "@/components/lawyer/comment-thread"
import { ProposeChange } from "@/components/lawyer/propose-change"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

// Assigned-review detail for the verified lawyer. All data arrives through
// the scoped bundle RPC (assignment + active status enforced server-side);
// the lawyer never touches owner tables directly. Findings, evidence, and
// clauses render read-only from the authoritative handoff snapshot.
export default async function LawyerReviewDetailPage({ params }: PageProps) {
  const { id } = await params
  let bundle: Record<string, unknown>
  try {
    const res = await getAssignedReview(id)
    bundle = res.bundle
  } catch {
    redirect("/lawyer/reviews")
  }

  const request = bundle.request as { id: string; status: string; request_note?: string | null } | undefined
  if (!request) notFound()

  // Needs-action banner + scoped activity + service orders. All derived
  // server-side from assigned-review data; the lawyer cannot influence what
  // appears here beyond their own legitimate actions.
  const openProposals = ((bundle.comments ?? []) as Array<Record<string, unknown>>).filter(
    (c) => c.author_role === "lawyer" && c.target_type === "document" && c.status === "open"
  ).length
  const openQuestions = ((bundle.comments ?? []) as Array<Record<string, unknown>>).filter(
    (c) => c.author_role === "client" && c.target_type === "question" && c.status === "open"
  ).length
  const attention = deriveAttention({
    status: request.status,
    openProposalCount: openProposals,
    openClientQuestions: openQuestions,
  })
  let activity: Array<Record<string, unknown>> = []
  let orders: Array<Record<string, unknown>> = []
  try {
    const [a, o] = await Promise.all([
      getReviewActivity(request.id, 20),
      getReviewServiceOrders(request.id),
    ])
    activity = a.events
    orders = o.orders
  } catch {
    // Feed sections degrade to empty; the review itself still renders.
  }
  const audit = (bundle.audit ?? {}) as Record<string, unknown>
  const versions = ((bundle.versions ?? []) as Array<Record<string, unknown>>)
  const comments = ((bundle.comments ?? []) as Array<Record<string, unknown>>).map((c) => ({
    id: String(c.id),
    author_role: String(c.author_role ?? ""),
    target_type: String(c.target_type ?? "general"),
    target_key: typeof c.target_key === "string" ? c.target_key : null,
    body: String(c.body ?? ""),
    status: String(c.status ?? "open"),
    provenance: String(c.provenance ?? ""),
    created_at: String(c.created_at ?? ""),
  })) as ThreadComment[]
  const signers = ((bundle.signers ?? []) as Array<Record<string, unknown>>)

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">Deal: {String(audit.title ?? "Untitled")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Review workspace</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Status: <span className="font-medium text-foreground">{request.status}</span>
          {typeof request.request_note === "string" && request.request_note ? ` · Client note: ${request.request_note}` : ""}
        </p>
        <div className="mt-3">
          <ReviewLifecycleButtons requestId={request.id} status={request.status} />
        </div>
      </div>

      {attention.needsAction && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-4">
          <p className="text-sm font-semibold text-foreground">You need to act</p>
          <ul className="mt-1 space-y-0.5">
            {attention.reasons.map((r) => (
              <li key={r} className="text-xs text-muted-foreground">· {r}</li>
            ))}
          </ul>
        </div>
      )}
      {!attention.needsAction && attention.waitingOn === "client" && (
        <div className="rounded-xl border border-warning/25 bg-warning/[0.07] p-4">
          <p className="text-sm font-semibold text-foreground">Waiting for client</p>
          <p className="mt-1 text-xs text-muted-foreground">Nothing is waiting on you right now.</p>
        </div>
      )}

      <section className="rounded-xl border border-border/60 bg-card p-5 space-y-2">
        <h2 className="text-sm font-semibold">Deal package (read-only, from Dealenz intelligence)</h2>
        <p className="text-xs text-muted-foreground">
          Type: {String(audit.deal_type ?? "unknown")} · Score: {String(audit.overall_score ?? "—")}
        </p>
        {typeof audit.raw_input === "string" && audit.raw_input.length > 0 && (
          <details>
            <summary className="text-xs font-medium cursor-pointer">Submitted deal input</summary>
            <p className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">{audit.raw_input.slice(0, 5000)}</p>
          </details>
        )}
      </section>

      <section className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Document versions ({versions.length})</h2>
        {versions.length === 0 && <p className="text-xs text-muted-foreground">No documents yet.</p>}
        {versions.slice(0, 5).map((v) => (
          <details key={String(v.id)}>
            <summary className="text-xs font-medium cursor-pointer">
              {String(v.document_type)} · v{String(v.version_number)} · {String(v.generation_method)}
            </summary>
            <div className="mt-2 rounded-lg border bg-muted/30 p-3 prose prose-sm max-w-none">
              {renderMarkdown(String(v.content ?? "").slice(0, 20000))}
            </div>
          </details>
        ))}
      </section>

      <CommentThread requestId={request.id} comments={comments} />

      {(request.status === "in_progress" || request.status === "changes_requested" || request.status === "client_review") && (
        <ProposeChange requestId={request.id} />
      )}

      <section className="rounded-xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-semibold">Signers ({signers.length})</h2>
        {signers.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No signers invited by the client yet.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {signers.map((s) => (
              <li key={String(s.id)} className="text-xs">
                {String(s.name)} ({String(s.party_label)}) — <span className="font-medium">{String(s.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-semibold">Activity</h2>
        {activity.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No activity yet on this review.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {activity.map((e) => (
              <li key={String(e.id)} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{String(e.event_type)}</span>
                {" · "}
                {new Date(String(e.created_at)).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-semibold">Service orders</h2>
        {orders.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No service orders. Amounts here are quoted-or-pending only — no earnings exist until a payment flow does.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {orders.map((o) => (
              <li key={String(o.id)} className="text-xs">
                Order {String(o.id).slice(0, 8)}… · {String(o.status)}
                {typeof o.amount_minor === "number" ? ` · ${o.amount_minor} ${String(o.currency ?? "")}` : " · amount to be quoted"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground">
        Your notes and proposals carry lawyer provenance. They do not alter Dealenz findings, rules, or sources. Suggested language is drafting assistance, not a determination of enforceability.
      </p>
    </div>
  )
}
