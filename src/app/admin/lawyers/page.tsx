import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const isAdmin = (user.user_metadata?.is_admin) === true
  if (!isAdmin) {
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

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Lawyer Verification</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve or reject lawyer applications
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <table className="w-full">
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
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    lawyer.verification_status === "verified"
                      ? "bg-emerald-100 text-emerald-700"
                      : lawyer.verification_status === "rejected"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {lawyer.verification_status}
                  </span>
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
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
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
                    <span className="text-xs text-emerald-600">Verified</span>
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
  )
}