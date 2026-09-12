"use client"

import Link from "next/link"

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "matched", label: "Requested" },
  { value: "accepted", label: "Accepted" },
  { value: "in_progress", label: "In progress" },
  { value: "changes_requested", label: "Changes proposed" },
  { value: "client_review", label: "Client review" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

// Filter controls for the assigned-review list. Presentation only: the
// selected values travel as query params and the server re-queries with the
// lawyer-scoped fence. No client filtering of records ever happens.
export function ReviewFilters({ status, needsAction }: { status: string; needsAction: boolean }) {
  const qs = (overrides: Record<string, string>) => {
    const next = new URLSearchParams()
    if (overrides.status ?? status) next.set("status", overrides.status ?? status)
    if (overrides.needsAction ?? (needsAction ? "1" : "")) next.set("needsAction", overrides.needsAction ?? "1")
    const s = next.toString()
    return s ? `/lawyer/reviews?${s}` : "/lawyer/reviews"
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <label className="text-xs text-muted-foreground">
        Status{" "}
        <select
          defaultValue={status}
          onChange={(e) => { window.location.href = qs({ status: (e.target as HTMLSelectElement).value }) }}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <Link
        href={qs({ needsAction: needsAction ? "" : "1" })}
        className={`inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium ${needsAction ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"}`}
      >
        Needs action{needsAction ? " ✓" : ""}
      </Link>
    </div>
  )
}
