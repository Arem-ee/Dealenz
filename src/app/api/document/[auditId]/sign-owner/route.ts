import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { signerId?: string }
  const signerId = typeof body.signerId === "string" ? body.signerId : ""
  if (!signerId) return NextResponse.json({ success: false, error: "Missing signer" }, { status: 400 })

  const { data, error } = await supabase.rpc("sign_as_owner", { p_signer_id: signerId })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  const row = Array.isArray(data) ? data[0] : data as { success?: boolean; message?: string } | null
  if (!row || (row as { success?: boolean }).success === false) {
    return NextResponse.json({ success: false, error: (row as { message?: string })?.message ?? "Signing failed" }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
