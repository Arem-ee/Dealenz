import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdminSessionUser, isValidUUID } from "@/lib/auth/admin"

async function getAdminUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Server-controlled authorization only: app_metadata is set with the
  // service role and cannot be self-granted via user_metadata.
  return isAdminSessionUser(user) ? user : null
}

type AdminAction = "verify" | "reject" | "suspend" | "reinstate"

// Governance transition map. Suspension is reversible and never destroys the
// record; rejection is terminal for the application (the owner may correct
// via resubmit, the admin re-decides from pending). Direct
// rejected -> verified is refused: every approval passes through review.
const ALLOWED_FROM: Record<AdminAction, string[]> = {
  verify: ["pending", "suspended"],
  reject: ["pending", "suspended"],
  suspend: ["verified"],
  reinstate: ["suspended"],
}

const RESULT_STATUS: Record<AdminAction, string> = {
  verify: "verified",
  reject: "rejected",
  suspend: "suspended",
  reinstate: "pending",
}

function cleanOptionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > max) return null
  return trimmed
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = await getAdminUser(supabase)

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let data
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { lawyer_id, action } = data

  if (!lawyer_id || !action) {
    return NextResponse.json({ error: "Missing lawyer_id or action" }, { status: 400 })
  }

  if (!isValidUUID(lawyer_id)) {
    return NextResponse.json({ error: "Invalid lawyer_id" }, { status: 400 })
  }

  if (action !== "verify" && action !== "reject" && action !== "suspend" && action !== "reinstate") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const typedAction = action as AdminAction

  const { data: lawyer, error: loadError } = await supabase
    .from("lawyers")
    .select("id, user_id, verification_status")
    .eq("id", lawyer_id)
    .maybeSingle<{ id: string; user_id: string | null; verification_status: string }>()

  if (loadError || !lawyer) {
    return NextResponse.json({ error: "Lawyer not found" }, { status: 404 })
  }

  if (!ALLOWED_FROM[typedAction].includes(lawyer.verification_status)) {
    return NextResponse.json(
      { error: `Cannot ${typedAction} a ${lawyer.verification_status} application` },
      { status: 409 }
    )
  }

  // Verification record: admin-supplied evidence of the review. Bounded
  // free text (source vocabulary documented in migration 00047); the DB
  // trigger independently rejects non-admin writes to these columns.
  const record = {
    verification_source: cleanOptionalText(data.verification_source, 40),
    regulator: cleanOptionalText(data.regulator, 120),
    license_status: cleanOptionalText(data.license_status, 20),
    verification_reference: cleanOptionalText(data.verification_reference, 120),
    verification_notes: cleanOptionalText(data.verification_notes, 2000),
  }
  const patch: Record<string, unknown> = {
    verification_status: RESULT_STATUS[typedAction],
    verified_at: typedAction === "verify" ? new Date().toISOString() : null,
    verified_by: admin.id,
    updated_at: new Date().toISOString(),
  }
  // The record travels with approvals; rejection/suspension keep prior
  // record text for audit continuity unless the admin replaces it.
  if (typedAction === "verify") {
    for (const [key, value] of Object.entries(record)) {
      if (value !== null) patch[key] = value
    }
  } else if (typedAction === "suspend") {
    if (record.license_status !== null) patch.license_status = record.license_status
    if (record.verification_notes !== null) patch.verification_notes = record.verification_notes
  }

  const { error } = await supabase
    .from("lawyers")
    .update(patch)
    .eq("id", lawyer_id)

  if (error) {
    return NextResponse.json({ error: "Could not update verification. Please try again." }, { status: 500 })
  }

  // Audit trail on existing infrastructure: the actor's own feed (RLS
  // owner-insert), lawyer + transition in the payload. Best-effort; a
  // logging failure never un-does the governance decision.
  try {
    await supabase.from("activity_events").insert({
      user_id: admin.id,
      audit_id: null,
      event_type: "lawyer_verification_changed",
      payload: {
        lawyer_id,
        from: lawyer.verification_status,
        to: RESULT_STATUS[typedAction],
        ...(record.verification_source ? { source: record.verification_source } : {}),
      },
      created_at: new Date().toISOString(),
    })
  } catch {
    // Audit write is best-effort.
  }

  return NextResponse.json({ success: true, status: RESULT_STATUS[typedAction] })
}
