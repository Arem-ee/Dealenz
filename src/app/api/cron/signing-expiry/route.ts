import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Daily expiry pass: pending invitations whose expiry has passed flip to
// 'expired' so queues read honestly. The row-level trigger (00090) already
// blocks signing on lapsed invitations; this pass only updates the visible
// state. Same auth contract as the deadline-reminders cron (CRON_SECRET
// bearer; open in development when unset). Idempotent: only pending rows
// match, and each row flips once.

export const dynamic = "force-dynamic"

const BATCH = 200

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (!cronSecret) return process.env.NODE_ENV !== "production"
  return auth === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 500 })

  const svc = createClient(url, key)

  const { data: rows, error } = await svc
    .from("document_signers")
    .select("id, name, email, audit_id")
    .eq("status", "pending")
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString())
    .limit(BATCH)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => String(r.id))
  if (ids.length === 0) return NextResponse.json({ ok: true, expired: 0 })

  const { error: updateError } = await svc
    .from("document_signers")
    .update({ status: "expired" })
    .in("id", ids)
    .eq("status", "pending")
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Owners learn about lapsed links through the notification center, not
  // by discovering them. Best-effort: the flip above already stands.
  let notified = 0
  try {
    const { notifyDealOwner } = await import("@/lib/notifications/notify")
    for (const r of ((rows ?? []) as Array<{ id: string; name: string; email: string; audit_id: string }>)) {
      try {
        await notifyDealOwner(svc, r.audit_id, {
          type: "signing",
          title: "Signing link expired",
          body: `${r.name || r.email || "An invitee"}'s invitation lapsed. Re-send or revoke it in Signing.`,
          link: "/signing",
        })
        notified += 1
      } catch {
        // One missed notification never blocks the rest.
      }
    }
  } catch {
    // Notification import failure never fails the cron.
  }
  return NextResponse.json({ ok: true, expired: ids.length, notified })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
