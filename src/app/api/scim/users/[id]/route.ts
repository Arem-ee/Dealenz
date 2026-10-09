import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isScimAuthorized, parseScimActive } from "@/lib/scim/scim"
import { checkAnonymousRateLimit, getTrustedClientIp, type AnonRateLimitClient } from "@/lib/rate-limit-anon"

export const dynamic = "force-dynamic"

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isScimAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: "Invalid user id." }, { status: 400 })
  const parsed = parseScimActive(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 500 })
  const svc = createClient(url, key)
  const quota = await checkAnonymousRateLimit(svc as unknown as AnonRateLimitClient, `scim:${getTrustedClientIp(req.headers)}`, 60, 3600)
  if (!quota.allowed) return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  const { data, error } = await svc.auth.admin.updateUserById(id, {
    ban_duration: parsed.active ? "none" : "876000h",
  })
  if (error || !data.user) return NextResponse.json({ error: "User not found." }, { status: 404 })
  try {
    await svc.from("activity_events").insert({
      type: parsed.active ? "scim_user_reactivated" : "scim_user_suspended",
      details: { user_id: id, active: parsed.active },
    })
  } catch {
    // Audit best-effort.
  }
  return NextResponse.json({ id: data.user.id, userName: data.user.email ?? "", active: parsed.active })
}

export async function DELETE() {
  // Exits suspend; they never erase. Deleting cascades the user's deals, so
  // the endpoint refuses and directs IdPs at PATCH active=false instead.
  return NextResponse.json(
    { error: "User deletion is refused. Suspend with PATCH active=false; the owner can erase via Settings." },
    { status: 405 }
  )
}
