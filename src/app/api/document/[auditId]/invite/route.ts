import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { name?: string; email?: string; partyLabel?: string; documentVersionId?: string }
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim() : ""
  const partyLabel = typeof body.partyLabel === "string" ? body.partyLabel.trim() || "counterparty" : "counterparty"
  const documentVersionId = typeof body.documentVersionId === "string" ? body.documentVersionId : null
  if (!name || name.length > 120) return NextResponse.json({ success: false, error: "Enter name" }, { status: 400 })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ success: false, error: "Enter valid email" }, { status: 400 })
  const { data: audit } = await supabase.from("audits").select("id").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  if (!audit) return NextResponse.json({ success: false, error: "Audit not found" }, { status: 404 })

  let versionId = documentVersionId
  if (!versionId) {
    const { data: latest } = await supabase.from("document_versions").select("id").eq("audit_id", auditId).order("version_number", { ascending: false }).limit(1).maybeSingle<{ id: string }>()
    if (!latest) return NextResponse.json({ success: false, error: "No document version to invite for" }, { status: 400 })
    versionId = latest.id
  }

  // Ensure version belongs to audit
  const { data: version } = await supabase.from("document_versions").select("id, document_type").eq("id", versionId).eq("audit_id", auditId).maybeSingle()
  if (!version) return NextResponse.json({ success: false, error: "Version not found" }, { status: 404 })

  // Generate token
  const token = `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`

  const { error } = await supabase.from("document_signers").insert({
    audit_id: auditId,
    document_type: (version as { document_type: string }).document_type,
    document_version_id: versionId,
    name,
    email: email.toLowerCase(),
    party_label: partyLabel,
    token,
    status: "pending",
  })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })

  // Ensure owner signer exists for owner-first order
  const { data: ownerSigner } = await supabase.from("document_signers").select("id").eq("audit_id", auditId).eq("document_version_id", versionId).eq("party_label", "owner").maybeSingle()
  if (!ownerSigner) {
    const ownerToken = `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`
    await supabase.from("document_signers").insert({
      audit_id: auditId,
      document_type: (version as { document_type: string }).document_type,
      document_version_id: versionId,
      name: user.email?.split("@")[0] ?? "Owner",
      email: user.email ?? "owner@example.com",
      party_label: "owner",
      token: ownerToken,
      status: "pending",
    })
  }

  return NextResponse.json({ success: true })
}
