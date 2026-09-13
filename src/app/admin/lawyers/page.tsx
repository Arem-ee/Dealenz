import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AssignReviewForm } from "@/components/admin/assign-review-form"
import { StatusBadge } from "@/components/ui/status-badge"
import { isAdminSessionUser } from "@/lib/auth/admin"

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Server-controlled authorization only (app_metadata, never user_metadata).
  if (!isAdminSessionUser(user)) {
    return null
  }

  return user
}

export default async function AdminLawyersPage() {
  const admin = await getAdminUser()
  if (!admin) {
    redirect("/dashboard")
  }

  const supabase = await createClient()

  const { data: lawyers } = await supabase
    .from("lawyers")
    .select("*")
    .order("created_at", { ascending: false })

  const { data: pendingReviews } = await supabase
    .from("consultation_requests")
    .select("id, audit_id, status, created_at")
    .in("status", ["requested", "waitlist"])
    .order("created_at", { ascending: true })
    .limit(50)

  const verifiedLawyers = ((lawyers ?? []) as Array<{ id: string; full_name: string; verification_status: string }>)
    .filter((l) => l.verification_status === "verified")
    .map((l) => ({ id: l.id, full_name: l.full_name }))

  const pendingCount = ((lawyers ?? []) as Array<{ verification_status: string }>)
    .filter((l) => l.verification_status === "pending").length

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lawyer Verification</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve or reject lawyer applications
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="ml-auto inline-flex items-center rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning-foreground">
            {pendingCount} pending
          </span>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 mb-6">
        <h2 className="text-sm font-semibold">Pending review assignments</h2>
        {!pendingReviews || pendingReviews.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No reviews waiting for assignment.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {(pendingReviews as Array<{ id: string; audit_id: string; status: string; created_at: string }>).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3">
                <div className="text-xs">
                  <p className="font-medium">Review {r.id.slice(0, 8)}… · {r.status}</p>
                  <p className="text-muted-foreground">Requested {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <AssignReviewForm requestId={r.id} lawyers={verifiedLawyers} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-border/60 bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lawyer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">License</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Specialties</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Experience</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Applied</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {lawyers?.map((lawyer) => (
              <tr key={lawyer.id} className="hover:bg-muted/50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    {lawyer.photo_url ? (
                      <img src={lawyer.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                        {lawyer.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{lawyer.full_name}</p>
                      {lawyer.user_id && (
                        <p className="text-xs text-muted-foreground">User: {lawyer.user_id.slice(0, 8)}...</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div>
                    <p className="text-sm font-medium font-mono">{lawyer.bar_license_number}</p>
                    <p className="text-xs text-muted-foreground">{lawyer.bar_jurisdiction}</p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    {lawyer.specialties?.map((s: string) => (
                      <span key={s} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {s.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm">
                  {lawyer.years_experience} years
                </td>
                <td className="px-4 py-4">
                  <StatusBadge
                    tone={
                      lawyer.verification_status === "verified"
                        ? "success"
                        : lawyer.verification_status === "rejected"
                        ? "error"
                        : "warning"
                    }
                  >
                    {lawyer.verification_status}
                  </StatusBadge>
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {new Date(lawyer.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-4 text-right">
                  {lawyer.verification_status === "pending" && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={async () => {
                          const res = await fetch("/api/admin/lawyers/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ lawyer_id: lawyer.id, action: "verify" }),
                          })
                          if (res.ok) window.location.reload()
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Verify
                      </button>
                      <button
                        onClick={async () => {
                          const res = await fetch("/api/admin/lawyers/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ lawyer_id: lawyer.id, action: "reject" }),
                          })
                          if (res.ok) window.location.reload()
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:bg-destructive/90 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {lawyer.verification_status === "verified" && (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-success">Verified</span>
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Pause ${lawyer.full_name}'s verification? They immediately lose professional access until reinstated.`)) return
                          const res = await fetch("/api/admin/lawyers/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ lawyer_id: lawyer.id, action: "suspend" }),
                          })
                          if (res.ok) window.location.reload()
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning-foreground hover:bg-warning/20 transition-colors"
                      >
                        Suspend
                      </button>
                    </div>
                  )}
                  {lawyer.verification_status === "suspended" && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={async () => {
                          const res = await fetch("/api/admin/lawyers/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ lawyer_id: lawyer.id, action: "reinstate" }),
                          })
                          if (res.ok) window.location.reload()
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                      >
                        Reinstate to review
                      </button>
                    </div>
                  )}
                  {lawyer.verification_status === "rejected" && (
                    <span className="text-xs text-destructive">Rejected</span>
                  )}
                </td>
              </tr>
            ))}
            {!lawyers?.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No lawyer applications yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}