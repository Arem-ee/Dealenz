import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendGmailForRow } from "@/lib/gmail/send"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null) as { planId?: string; planVersion?: number; rowId?: string; to?: string; subject?: string; body?: string } | null
  if (!body?.planId || !body?.rowId || !body?.to) return NextResponse.json({ error: "Missing planId, rowId, to" }, { status: 400 })

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
