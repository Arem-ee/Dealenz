import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("lawyers")
    .select("verification_status, created_at, verified_at, full_name, bio, bar_license_number, bar_jurisdiction, specialties, years_experience, notable_cases, certifications")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ success: true, status: "not_applied" })
  }

  const row = data as Record<string, unknown>
  return NextResponse.json({
    success: true,
    status: row.verification_status,
    created_at: row.created_at,
    verified_at: row.verified_at,
    application: {
      full_name: row.full_name ?? "",
      bio: row.bio ?? "",
      bar_license_number: row.bar_license_number ?? "",
      bar_jurisdiction: row.bar_jurisdiction ?? "",
      specialties: Array.isArray(row.specialties) ? row.specialties : [],
      years_experience: typeof row.years_experience === "number" ? row.years_experience : 0,
      notable_cases: (row.notable_cases as string | null) ?? "",
      certifications: Array.isArray(row.certifications) ? row.certifications : [],
    },
  })
}
