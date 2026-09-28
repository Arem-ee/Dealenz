import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"

// Bring-your-own-paper: versions a contract the user already has (written
// elsewhere, received by email, signed on paper) as a signable document
// version — no analysis, no AI generation, no credits. Storage-only: the
// credit charge lands later at invite time, exactly like generated versions.
// This is what makes sign-only and track-only use real: without it, versions
// exist solely as AI output and every signing/tracking flow forces analysis.

const ALLOWED_TYPES = ["contract", "agreement", "nda", "proposal", "sow", "checklist"] as const
const MAX_CONTENT_CHARS = 100_000
const MAX_TITLE_CHARS = 120

export async function POST(req: NextRequest, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  if (!user.email_confirmed_at) {
    return NextResponse.json({ success: false, error: "Please verify your email address before adding a document." }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }
  const input = body as Record<string, unknown>
  const documentType = typeof input.documentType === "string" ? input.documentType.trim().toLowerCase() : ""
  const title = typeof input.title === "string" ? input.title.trim() : ""
  const content = typeof input.content === "string" ? input.content : ""
  if (!(ALLOWED_TYPES as readonly string[]).includes(documentType)) {
    return NextResponse.json({ success: false, error: "Choose a document type: contract, agreement, NDA, proposal, SOW, or checklist." }, { status: 400 })
  }
  if (title.length > MAX_TITLE_CHARS) {
    return NextResponse.json({ success: false, error: "Name is too long (120 characters max)." }, { status: 400 })
  }
  const trimmed = content.trim()
  if (trimmed.length === 0) {
    return NextResponse.json({ success: false, error: "Paste the contract text first." }, { status: 400 })
  }
  if (trimmed.length > MAX_CONTENT_CHARS) {
    return NextResponse.json({ success: false, error: "That text is too long (100,000 characters max). Split it or attach the key sections." }, { status: 400 })
  }

  const rate = await checkRateLimit("upload_version")
  if (!rate.allowed) {
    return NextResponse.json({ success: false, error: rate.error ?? "Rate limit exceeded" }, { status: 429 })
  }

  const { data: audit } = await supabase.from("audits").select("id").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  if (!audit) {
    return NextResponse.json({ success: false, error: "Deal not found" }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from("document_versions")
    .select("version_number")
    .eq("audit_id", auditId)
    .eq("document_type", documentType)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number }>()
  const nextVersionNumber = typeof existing?.version_number === "number" ? existing.version_number + 1 : 1

  const { data: inserted, error } = await supabase
    .from("document_versions")
    .insert({
      audit_id: auditId,
      user_id: user.id,
      document_type: documentType,
      version_number: nextVersionNumber,
      content: trimmed,
      generation_method: "upload",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (error || !inserted) {
    const { sanitizeUserError } = await import("@/lib/errors/sanitize")
    return NextResponse.json({ success: false, error: sanitizeUserError(error?.message ?? "Could not save the document.") }, { status: 400 })
  }

  if (title) {
    await supabase.from("audits").update({ title: title.slice(0, MAX_TITLE_CHARS), updated_at: new Date().toISOString() }).eq("id", auditId).eq("user_id", user.id)
  }

  return NextResponse.json({
    success: true,
    versionId: (inserted as { id: string }).id,
    versionNumber: nextVersionNumber,
  })
}
