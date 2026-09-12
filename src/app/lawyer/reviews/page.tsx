import Link from "next/link"
import { redirect } from "next/navigation"
import { listAssignedReviews } from "../actions"
import { ReviewFilters } from "@/components/lawyer/review-filters"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<{ status?: string; needsAction?: string; page?: string }>
}

// Assigned-review list with server-side status filter, needs-action filter,
// and bounded pagination. The query is lawyer-scoped (lawyer_id fence);
// filtering/sorting never widen access, and pages cannot reveal other
// lawyers' records.
export default async function LawyerReviewsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = typeof params.status === "string" ? params.status : ""
  const needsAction = params.needsAction === "1"
  const page = Math.max(parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1, 1)

  let reviews: Awaited<ReturnType<typeof listAssignedReviews>>["reviews"] = []
  let hasMore = false
  try {
    const res = await listAssignedReviews({
      status: status || null,
      needsAction: needsAction || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
    reviews = res.reviews
    hasMore = res.hasMore
  } catch {
    redirect("/dashboard")
  }

  const pageQs = (p: number) => {
    const next = new URLSearchParams()
    if (status) next.set("status", status)
    if (needsAction) next.set("needsAction", "1")
    if (p > 1) next.set("page", String(p))
    const s = next.toString()
    return s ? `/lawyer/reviews?${s}` : "/lawyer/reviews"
  }

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">Assigned reviews</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Deals assigned to you for professional review. Access ends automatically when a review completes or is cancelled.
      </p>

      <ReviewFilters status={status} needsAction={needsAction} />

      {reviews.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border/60 bg-card p-8 text-center">
          <p className="text-sm font-medium">No assigned reviews</p>
          <p className="mt-1 text-xs text-muted-foreground">New assignments from Dealenz clients will appear here.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {reviews.map((r) => (
            <li key={String(r.id)} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    Review {String(r.id).slice(0, 8)}…
                    {r.needsAction && <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Needs action</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">Updated {new Date(String(r.updated_at)).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {String(r.status)}
                </span>
              </div>
              <Link
                href={`/lawyer/reviews/${String(r.id)}`}
                className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
              >
                Open review →
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        {page > 1 && (
          <Link href={pageQs(page - 1)} className="text-xs font-medium text-primary hover:underline">
            ← Newer
          </Link>
        )}
        {hasMore && (
          <Link href={pageQs(page + 1)} className="text-xs font-medium text-primary hover:underline">
            Older →
          </Link>
        )}
      </div>
    </div>
  )
}
