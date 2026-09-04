import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function getAdminUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const isAdmin = (user.user_metadata?.is_admin) === true
  return isAdmin ? user : null
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

  if (action !== "verify" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const { error } = await supabase
    .from("lawyers")
    .update({
      verification_status: action === "verify" ? "verified" : "rejected",
      verified_at: action === "verify" ? new Date().toISOString() : null,
      verified_by: admin.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lawyer_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}