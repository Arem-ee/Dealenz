import Link from "next/link"
import { redirect } from "next/navigation"
import { getOwnLawyerProfile } from "../actions"

export const dynamic = "force-dynamic"

// Lawyer profile/settings area. Read-only: verification status and identity
// fields are admin-controlled (Phase 6 DB guard blocks self-promotion), so
// no edit surface exists here by design.
export default async function LawyerProfilePage() {
  let profile: Record<string, unknown>
  try {
    const res = await getOwnLawyerProfile()
    profile = res.profile as Record<string, unknown>
  } catch {
    redirect("/dashboard")
  }

  const barParts = [profile.bar_license_number, profile.bar_jurisdiction]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0)
  const rows: Array<[string, string]> = [
    ["Name", String(profile.full_name ?? "—")],
    ["Account email", String(profile.email ?? "—")],
    ["Verification status", String(profile.verification_status ?? "—")],
    ["Bar license", barParts.length > 0 ? barParts.join(" · ") : "—"],
    ["Experience", typeof profile.years_experience === "number" ? `${profile.years_experience} years` : "—"],
    ["Specialties", Array.isArray(profile.specialties) ? (profile.specialties as string[]).join(", ") || "—" : "—"],
    ["Member since", profile.created_at ? new Date(String(profile.created_at)).toLocaleDateString() : "—"],
  ]

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/lawyer" className="text-xs font-medium text-primary hover:underline">← Workspace</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your professional details as stored by Dealenz. Verification and identity fields can only be changed by a Dealenz administrator.
        </p>
      </div>
      <dl className="rounded-xl border border-border/60 bg-card divide-y divide-border/60">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium text-right">{value}</dd>
          </div>
        ))}
      </dl>
      {typeof profile.bio === "string" && profile.bio.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Bio</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{profile.bio}</p>
        </div>
      )}
    </div>
  )
}
