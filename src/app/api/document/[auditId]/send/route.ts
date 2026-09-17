import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { documentVersionId?: string }
  const versionId = typeof body.documentVersionId === "string" ? body.documentVersionId : null
  const { data: audit } = await supabase.from("audits").select("id").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  if (!audit) return NextResponse.json({ success: false, error: "Audit not found" }, { status: 404 })

  let targetVersionId = versionId
  if (!targetVersionId) {
    const { data: latest } = await supabase.from("document_versions").select("id").eq("audit_id", auditId).order("version_number", { ascending: false }).limit(1).maybeSingle<{ id: string }>()
    if (!latest) return NextResponse.json({ success: false, error: "No version" }, { status: 400 })
    targetVersionId = latest.id
  }

  const { data: version } = await supabase.from("document_versions").select("id, document_type").eq("id", targetVersionId).eq("audit_id", auditId).maybeSingle()
  if (!version) return NextResponse.json({ success: false, error: "Version not found" }, { status: 404 })

  // Mark as final if not already
  const { data: existingFinal } = await supabase.from("final_documents").select("id, document_version_id").eq("audit_id", auditId).eq("document_type", (version as { document_type: string }).document_type).maybeSingle<{ id: string; document_version_id: string }>()
  if (!existingFinal) {
    await supabase.from("final_documents").insert({
      audit_id: auditId,
      document_type: (version as { document_type: string }).document_type,
      document_version_id: targetVersionId,
    })
  } else {
    // If already final but not this version, check if executed — if executed, don't move
    const { data: signers } = await supabase.from("document_signers").select("status").eq("document_version_id", existingFinal.document_version_id)
    const rows = (signers ?? []) as Array<{ status: string }>
    const executed = rows.length > 0 && rows.every((s) => s.status === "signed")
    if (!executed) {
      await supabase.from("final_documents").update({ document_version_id: targetVersionId }).eq("audit_id", auditId).eq("document_type", (version as { document_type: string }).document_type)
    }
  }

  // Activity for notification simulation
  await supabase.from("activity_events").insert({
    user_id: user.id,
    audit_id: auditId,
    event_type: "document_sent",
    payload: { document_version_id: targetVersionId },
  })

  return NextResponse.json({ success: true })
}
