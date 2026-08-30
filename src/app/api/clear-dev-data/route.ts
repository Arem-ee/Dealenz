import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from("audits")
    .delete()
    .eq("user_id", user.id)
    .in("title", ["New Audit", "New Deal"])
    .not("status", "in", '("in_progress","processing")')
    .lt("created_at", twentyFourHoursAgo)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
