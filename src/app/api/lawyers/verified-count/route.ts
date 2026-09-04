import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ count: 0 })
  }

  const { count } = await supabase
    .from("lawyers")
    .select("*", { count: "exact", head: true })
    .eq("verification_status", "verified")

  return NextResponse.json({ count: count ?? 0 })
}