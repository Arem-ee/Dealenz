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
    .select("verification_status, created_at, verified_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ success: true, status: "not_applied" })
  }

  return NextResponse.json({
    success: true,
    status: data.verification_status,
    created_at: data.created_at,
    verified_at: data.verified_at,
  })
}