import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  // Same gates as every sibling ceremony route: verified senders only,
  // bounded rate — signing mutates shared legal state.
  if (!user.email_confirmed_at) return NextResponse.json({ success: false, error: "Please verify your email address before signing." }, { status: 403 })
  const { checkRateLimit } = await import("@/lib/rate-limit")
  const rate = await checkRateLimit("document_send")
  if (!rate.allowed) {
    return NextResponse.json({ success: false, error: rate.error ?? "Rate limit exceeded" }, { status: 429 })
  }
  const body = await req.json().catch(() => ({})) as { signerId?: string; imageData?: string; method?: string }
  const signerId = typeof body.signerId === "string" ? body.signerId : ""
  if (!signerId) return NextResponse.json({ success: false, error: "Missing signer" }, { status: 400 })
  // Optional drawn/typed signature image, validated before anything signs:
  // a recorded owner signature always carries its image, never a missing one.
  let artifact: { imageData: string; method: "drawn" | "typed" | "uploaded" } | null = null
  if (body.imageData !== undefined || body.method !== undefined) {
    const { validateSignatureArtifact } = await import("@/lib/signatures/validate")
    const valid = validateSignatureArtifact({ imageData: body.imageData, method: body.method })
    if (!valid.ok) return NextResponse.json({ success: false, error: valid.error }, { status: 400 })
    artifact = { imageData: valid.imageData, method: valid.method }
  }
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

  // Artifact-first like the invitee flow: the image lands before the RPC
  // flips the status, so a recorded signature always has its image. An RPC
  // failure after this leaves an orphan artifact on a still-pending signer,
  // which the next attempt upserts — never a signed row without an image.
  if (artifact) {
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceUrl || !serviceKey) {
      return NextResponse.json({ success: false, error: "Service unavailable. Please try again." }, { status: 500 })
    }
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const service = createServiceClient(serviceUrl, serviceKey)
    const { error: artifactError } = await service.from("signer_signature_artifacts").upsert(
      { signer_id: signerId, image_data: artifact.imageData, method: artifact.method },
      { onConflict: "signer_id" }
    )
    if (artifactError) {
      return NextResponse.json({ success: false, error: "Could not save the signature image. Please try again." }, { status: 500 })
    }
  }

  const { data, error } = await supabase.rpc("sign_as_owner", { p_signer_id: signerId })
  if (error) return NextResponse.json({ success: false, error: "Signing failed. Please try again." }, { status: 400 })
  const row = Array.isArray(data) ? data[0] : data as { success?: boolean; message?: string } | null
  if (!row || (row as { success?: boolean }).success === false) {
    return NextResponse.json({ success: false, error: (row as { message?: string })?.message ?? "Signing failed" }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
