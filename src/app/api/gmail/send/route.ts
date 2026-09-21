import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { sendGmailForRow } from "@/lib/gmail/send"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // External email is consequential: verified senders only, bounded rate,
  // validated shape. The Gmail tokens themselves authorize delivery.
  if (!user.email_confirmed_at) return NextResponse.json({ error: "Please verify your email address before sending." }, { status: 403 })
  const body = await req.json().catch(() => null) as { planId?: string; planVersion?: number; rowId?: string; to?: string; subject?: string; body?: string } | null
  if (!body?.planId || !body?.rowId || !body?.to) return NextResponse.json({ error: "Missing planId, rowId, to" }, { status: 400 })
  if (!EMAIL_RE.test(body.to) || body.to.length > 254) return NextResponse.json({ error: "Invalid recipient" }, { status: 400 })
  if (typeof body.subject === "string" && body.subject.length > 200) return NextResponse.json({ error: "Subject too long" }, { status: 400 })
  if (typeof body.body === "string" && body.body.length > 20000) return NextResponse.json({ error: "Body too long" }, { status: 400 })
  const rate = await checkRateLimit("gmail_send")
  if (!rate.allowed) return NextResponse.json({ error: rate.error ?? "Send limit reached. Try again tomorrow." }, { status: 429 })

  // Server-derived plan ownership check
  const { data: plan } = await supabase.from("work_plans").select("id, user_id, version").eq("id", body.planId).eq("user_id", user.id).maybeSingle()
  if (!plan) return NextResponse.json({ error: "Plan not found or not owned" }, { status: 404 })

  try {
    const result = await sendGmailForRow(supabase as never, user.id, {
      planId: body.planId,
      planVersion: body.planVersion ?? 1,
      rowId: body.rowId,
      to: body.to,
      subject: body.subject ?? `Proposal for ${body.to}`,
      body: body.body ?? "",
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed"
    if (msg.includes("Gmail not connected")) return NextResponse.json({ error: msg }, { status: 400 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
