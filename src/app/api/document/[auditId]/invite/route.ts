import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { reportError } from "@/lib/logger"
import { SIGNATURE_SEND_CREDITS } from "@/lib/credits/pricing"
import {
  finalizeReservation,
  reserveCredits,
  voidReservation,
  type LedgerClient,
} from "@/lib/credits/ledger"

export async function POST(req: NextRequest, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { name?: string; email?: string; partyLabel?: string; documentVersionId?: string }
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim() : ""
  // Owner rows are created server-side by this route (ensure-owner); callers
  // may only add counterparties. Free-text labels previously allowed an
  // "owner"/"Owner " signer that evaded the owner-first ordering checks.
  const partyLabel = "counterparty"
  const documentVersionId = typeof body.documentVersionId === "string" ? body.documentVersionId : null
  if (!name || name.length > 120) return NextResponse.json({ success: false, error: "Enter name" }, { status: 400 })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ success: false, error: "Enter valid email" }, { status: 400 })
  if (!user.email_confirmed_at) return NextResponse.json({ success: false, error: "Please verify your email address before inviting signers." }, { status: 403 })

  // Abuse-rate cap on top of the credit charge: invites email real
  // counterparties, so funded spam is a reputation risk, not just compute.
  const { checkRateLimit } = await import("@/lib/rate-limit")
  const rate = await checkRateLimit("document_invite")
  if (!rate.allowed) {
    return NextResponse.json({ success: false, error: rate.error ?? "Rate limit exceeded" }, { status: 429 })
  }

  // Credit gate at the point of use (fail fast, before any reads/writes):
  // sending a signature request costs SIGNATURE_SEND_CREDITS. Same balance
  // check as every other billable operation — never-purchased accounts
  // cannot afford it. Deducted only when the invite is created; 402 (not a
  // generic upsell) on denial.
  const ledger: LedgerClient = {
    rpc: async (functionName: string, args: Record<string, unknown> = {}) => {
      const result = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
        functionName,
        args
      )
      return { data: result.data, error: result.error }
    },
  }
  let reservation: { allowed: boolean; reservationId: string | null }
  try {
    reservation = await reserveCredits(ledger, {
      operation: "document_analysis",
      amount: SIGNATURE_SEND_CREDITS,
      idempotencyKey: `invite:${auditId}:${crypto.randomUUID()}`,
    })
  } catch {
    return NextResponse.json({ success: false, error: "Could not verify credit balance. Please try again." }, { status: 500 })
  }
  if (!reservation.allowed || !reservation.reservationId) {
    return NextResponse.json({ success: false, error: `Insufficient credits for this operation. Sending a signature request costs ${SIGNATURE_SEND_CREDITS} credits.` }, { status: 402 })
  }

  const { data: audit } = await supabase.from("audits").select("id").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  if (!audit) {
    await voidReservation(ledger, reservation.reservationId).catch(() => null)
    return NextResponse.json({ success: false, error: "Audit not found" }, { status: 404 })
  }

  let versionId = documentVersionId
  if (!versionId) {
    const { data: latest } = await supabase.from("document_versions").select("id").eq("audit_id", auditId).order("version_number", { ascending: false }).limit(1).maybeSingle<{ id: string }>()
    if (!latest) {
      await voidReservation(ledger, reservation.reservationId).catch(() => null)
      return NextResponse.json({ success: false, error: "No document version to invite for" }, { status: 400 })
    }
    versionId = latest.id
  }

  // Ensure version belongs to audit
  const { data: version } = await supabase.from("document_versions").select("id, document_type").eq("id", versionId).eq("audit_id", auditId).maybeSingle()
  if (!version) {
    await voidReservation(ledger, reservation.reservationId).catch(() => null)
    return NextResponse.json({ success: false, error: "Version not found" }, { status: 404 })
  }

  try {
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
    if (error) {
      await voidReservation(ledger, reservation.reservationId).catch(() => null)
      const { sanitizeUserError } = await import("@/lib/errors/sanitize")
      return NextResponse.json({ success: false, error: sanitizeUserError(error.message) }, { status: 400 })
    }

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

    await finalizeReservation(ledger, {
      reservationId: reservation.reservationId,
      consumptionAmount: SIGNATURE_SEND_CREDITS,
      operation: "document_analysis",
    }).catch(async (e) => {
      // The invite itself was created; a settlement-only failure is logged
      // for ops rather than rewriting success into failure.
      await reportError(supabase, {
        phase: "invite_settle",
        error: e,
        details: { step: "finalize", auditId },
        severity: "error",
        userId: user.id,
      })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    await voidReservation(ledger, reservation.reservationId).catch(() => null)
    const msg = e instanceof Error ? e.message : "Failed to send invite"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
