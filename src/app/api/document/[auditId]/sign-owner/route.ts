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
  // Enforce that the signer belongs to the route's auditId — prevents auditId param confusion and audit trail mismatch
  const { data: signerRow } = await supabase.from("document_signers").select("audit_id").eq("id", signerId).maybeSingle()
  if (!signerRow || (signerRow as { audit_id?: string }).audit_id !== auditId) {
    return NextResponse.json({ success: false, error: "Signer does not belong to this audit" }, { status: 400 })
  }
  // Defense in depth on top of the owner-scoped RLS read above: the audit
  // itself must belong to the caller.
  const { data: owned } = await supabase.from("audits").select("id").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  if (!owned) {
    return NextResponse.json({ success: false, error: "Signer does not belong to this audit" }, { status: 400 })
  }

  const { data, error } = await supabase.rpc("sign_as_owner", { p_signer_id: signerId })
  if (error) return NextResponse.json({ success: false, error: "Signing failed. Please try again." }, { status: 400 })
  const row = Array.isArray(data) ? data[0] : data as { success?: boolean; message?: string } | null
  if (!row || (row as { success?: boolean }).success === false) {
    return NextResponse.json({ success: false, error: (row as { message?: string })?.message ?? "Signing failed" }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
