import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { validateLawyerIntake } from "@/lib/validation/lawyer-intake"

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

  const validated = validateLawyerIntake(data)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const rate = await checkRateLimit("submitLawyerApplication")
  if (!rate.allowed) {
    return NextResponse.json({ error: rate.error ?? "Rate limit exceeded" }, { status: 429 })
  }

  const { data: existing } = await supabase
    .from("lawyers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "You have already submitted an application" }, { status: 400 })
  }

  const v = validated.value
  const { error } = await supabase
    .from("lawyers")
    .insert({
      user_id: user.id,
      full_name: v.full_name,
      bio: v.bio,
      bar_license_number: v.bar_license_number,
      bar_jurisdiction: v.bar_jurisdiction,
      specialties: v.specialties,
      years_experience: v.years_experience,
      notable_cases: v.notable_cases,
      certifications: v.certifications,
      verification_status: "pending",
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/**
 * Owner correction path: a rejected applicant may return their own
 * application to pending for re-review (optionally with corrected
 * credentials in the same write). Shares the submission rate limit.
 * Verified/suspended/pending rows are refused; suspension is governance
 * and only an admin lifts it. The DB trigger independently enforces that
 * non-admins can only move rejected -> pending without touching the
 * verification record.
 */
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to update your application" }, { status: 401 })
  }

  let data
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from("lawyers")
    .select("id, verification_status")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; verification_status: string }>()

  if (!existing) {
    return NextResponse.json({ error: "No application found. Submit an application first." }, { status: 404 })
  }

  if (existing.verification_status !== "rejected") {
    return NextResponse.json(
      { error: "Only rejected applications can be resubmitted for review" },
      { status: 409 }
    )
  }

  const rate = await checkRateLimit("submitLawyerApplication")
  if (!rate.allowed) {
    return NextResponse.json({ error: rate.error ?? "Rate limit exceeded" }, { status: 429 })
  }

  // Optional corrected credentials travel with the resubmission. They are
  // merged over the stored application and the COMPLETE result is
  // re-validated, so partial corrections can never store unvalidated data.
  // Verification record columns can never be set here — the trigger rejects
  // non-admin writes to them.
  const corrections = data && typeof data === "object" ? (data as Record<string, unknown>) : {}
  const correctionKeys = [
    "full_name",
    "bio",
    "bar_license_number",
    "bar_jurisdiction",
    "specialties",
    "years_experience",
    "notable_cases",
    "certifications",
  ] as const
  const hasCorrections = correctionKeys.some((key) => corrections[key] !== undefined)

  const patch: Record<string, unknown> = {
    verification_status: "pending",
    updated_at: new Date().toISOString(),
  }

  if (hasCorrections) {
    const { data: stored } = await supabase
      .from("lawyers")
      .select("full_name, bio, bar_license_number, bar_jurisdiction, specialties, years_experience, notable_cases, certifications")
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .maybeSingle<Record<string, unknown>>()
    if (!stored) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }
    const merged: Record<string, unknown> = { ...stored }
    for (const key of correctionKeys) {
      if (corrections[key] !== undefined) merged[key] = corrections[key]
    }
    const validated = validateLawyerIntake(merged)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }
    Object.assign(patch, validated.value)
  }

  const { error } = await supabase
    .from("lawyers")
    .update(patch)
    .eq("id", existing.id)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: "pending" })
}