import Link from "next/link"
import { redirect } from "next/navigation"
import { getLawyerOverview } from "./actions"

export const dynamic = "force-dynamic"

// Lawyer workspace home: workload buckets, needs-action items, and recent
// activity — all computed from lawyer-scoped server queries. No global
// counts, no other lawyer's data, no marketplace statistics.
export default async function LawyerWorkspacePage() {
  let overview: Awaited<ReturnType<typeof getLawyerOverview>>
  try {
    overview = await getLawyerOverview()
  } catch {
    redirect("/dashboard")
  }

  const buckets = [
    { label: "Needs action", value: overview.buckets.needsAction, href: "/lawyer/reviews?needsAction=1", tone: "text-destructive" },
    { label: "In review", value: overview.buckets.inReview, href: "/lawyer/reviews", tone: "text-foreground" },
    { label: "Waiting for client", value: overview.buckets.waitingClient, href: "/lawyer/reviews", tone: "text-warning-foreground" },
    { label: "Completed", value: overview.buckets.completed, href: "/lawyer/reviews?status=completed", tone: "text-success" },
  ]

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {overview.totalAssigned} assigned review{overview.totalAssigned === 1 ? "" : "s"} total
          </p>
        </div>
        <Link href="/lawyer/profile" className="text-xs font-medium text-primary hover:underline">
          Profile →
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {buckets.map((b) => (
          <Link
            key={b.label}
            href={b.href}
            className="rounded-xl border border-border/60 bg-card p-4 hover:border-primary/40 transition-colors"
          >
            <p className={`text-2xl font-bold tabular-nums ${b.tone}`}>{b.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{b.label}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-semibold">Needs your action</h2>
        {overview.actionItems.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">Nothing waiting on you right now. New client requests land in <Link href="/lawyer/reviews" className="font-medium text-primary hover:underline">Reviews</Link>.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {overview.actionItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-medium">Review {item.id.slice(0, 8)}… · {item.status}</p>
                  <p className="text-muted-foreground">{item.reasons.join(" · ")}</p>
                </div>
                <Link href={`/lawyer/reviews/${item.id}`} className="shrink-0 font-medium text-primary hover:underline">
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <Link href="/lawyer/reviews" className="text-xs font-medium text-primary hover:underline">
            All reviews →
          </Link>
        </div>
        {overview.recentActivity.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No recent activity on your reviews. Updates from your assigned reviews will show here.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {overview.recentActivity.slice(0, 10).map((e) => (
              <li key={String(e.id)} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{String(e.event_type)}</span>
                {" · "}
                {new Date(String(e.created_at)).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
