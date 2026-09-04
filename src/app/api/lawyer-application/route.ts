import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to apply" }, { status: 401 })
  }

  let data
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const {
    full_name,
    bio,
    bar_license_number,
    bar_jurisdiction,
    specialties,
    years_experience,
    notable_cases,
    certifications,
  } = data

  if (!full_name || !bio || !bar_license_number || !bar_jurisdiction) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from("lawyers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "You have already submitted an application" }, { status: 400 })
  }

  const { error } = await supabase
    .from("lawyers")
    .insert({
      user_id: user.id,
      full_name,
      bio,
      bar_license_number,
      bar_jurisdiction,
      specialties: specialties ?? [],
      years_experience: years_experience ?? 0,
      notable_cases: notable_cases ?? null,
      certifications: certifications ?? [],
      verification_status: "pending",
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}