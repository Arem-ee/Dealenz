import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { checkRateLimit } from "@/lib/rate-limit"

// Record an externally-completed signing: the paper was signed elsewhere
// (DocuSign, paper, another tool) and the user tracks it here. No credits —
// pure record-keeping, no AI, no emails. This is what makes track-only use
// real: without it, the Tracker only ever lists ceremonies Dealenz itself
// ran, and contracts signed anywhere else are invisible.
//
// NOT part of the signing state machine: the machine's ordering guarantees
// (owner-first, every-counterparty) govern signatures Dealenz witnesses.
// Externally-witnessed signatures bypass it explicitly, flagged in metadata
// (recorded_externally) so no downstream reader mistakes them for witnessed
// ones. Allowed from any non-terminal version status; terminal states
// (fully_signed, locked, superseded) are rejected, never rewritten.

const RECORDABLE_STATUSES = ["draft", "ready_to_sign", "ready_to_send", "owner_signed", "counterparty_pending", "sent"]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest, { params }: { params: Promise<{ auditId: string; versionId: string }> }) {
  const { auditId, versionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  if (!user.email_confirmed_at) {
    return NextResponse.json({ success: false, error: "Please verify your email address before recording signatures." }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }
  const signedAtRaw = typeof (body as Record<string, unknown>).signedAt === "string" ? ((body as Record<string, unknown>).signedAt as string).trim() : ""
  if (!DATE_RE.test(signedAtRaw)) {
    return NextResponse.json({ success: false, error: "Give the signing date as YYYY-MM-DD." }, { status: 400 })
  }
  const signedAt = new Date(`${signedAtRaw}T00:00:00Z`)
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z")
  if (Number.isNaN(signedAt.getTime()) || signedAt > today || signedAt < new Date("1990-01-01T00:00:00Z")) {
    return NextResponse.json({ success: false, error: "That signing date is not plausible — it must be between 1990 and today." }, { status: 400 })
  }

  const rate = await checkRateLimit("upload_version")
  if (!rate.allowed) {
    return NextResponse.json({ success: false, error: rate.error ?? "Rate limit exceeded" }, { status: 429 })
  }

  const { data: audit } = await supabase.from("audits").select("id").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  if (!audit) {
    return NextResponse.json({ success: false, error: "Deal not found" }, { status: 404 })
  }

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceUrl || !serviceKey) {
    return NextResponse.json({ success: false, error: "Service unavailable. Please try again." }, { status: 500 })
  }
  const service = createServiceClient(serviceUrl, serviceKey)
  const { data: version } = await service
    .from("document_versions")
    .select("id, status, metadata")
    .eq("id", versionId)
    .eq("audit_id", auditId)
    .eq("user_id", user.id)
    .maybeSingle()
  const row = version as { id: string; status: string | null; metadata: Record<string, unknown> | null } | null
  if (!row) {
    return NextResponse.json({ success: false, error: "Document version not found" }, { status: 404 })
  }
  if (!RECORDABLE_STATUSES.includes(row.status ?? "draft")) {
    return NextResponse.json({ success: false, error: "That version is already closed — only open versions can record an external signing." }, { status: 400 })
  }

  // Walk the lifecycle chain along legal arms (draft→ready_to_sign→
  // owner_signed→counterparty_pending→fully_signed): a direct jump raises
  // the transition trigger. Each step is conditional so re-runs and
  // mid-chain versions converge instead of erroring.
  const chain: Array<{ from: string[]; to: string }> = [
    { from: ["draft"], to: "ready_to_sign" },
    { from: ["ready_to_sign", "ready_to_send"], to: "owner_signed" },
    { from: ["owner_signed"], to: "counterparty_pending" },
  ]
  for (const step of chain) {
    const { data: current } = await service.from("document_versions").select("status").eq("id", versionId).maybeSingle()
    const status = (current as { status?: string } | null)?.status
    if (status && step.from.includes(status)) {
      const { error: stepError } = await service.from("document_versions").update({ status: step.to }).eq("id", versionId)
      if (stepError) {
        return NextResponse.json({ success: false, error: "Could not record the signing. Please try again." }, { status: 500 })
      }
    }
  }

  const { data: recorded, error } = await service
    .from("document_versions")
    .update({
      status: "fully_signed",
      fully_signed_at: signedAt.toISOString(),
      metadata: { ...(row.metadata ?? {}), recorded_externally: true, recorded_at: new Date().toISOString() },
    })
    .eq("id", versionId)
    .in("status", ["counterparty_pending", "sent"])
    .select("id")
  if (error || !recorded || (Array.isArray(recorded) && recorded.length === 0)) {
    return NextResponse.json({ success: false, error: "Could not record the signing. Please try again." }, { status: 500 })
  }
  // Seal the recorded content best-effort: externally-signed paper gets the
  // same tamper evidence as witnessed ceremonies from this point forward.
  // Seal failure never fails the recording itself.
  try {
    const { ensureVersionSeal } = await import("@/lib/signatures/seal")
    await ensureVersionSeal(service as never, { auditId, versionId, userId: user.id })
  } catch {
    // Best-effort only.
  }
  return NextResponse.json({ success: true })
}
