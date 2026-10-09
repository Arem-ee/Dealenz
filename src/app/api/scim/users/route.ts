import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isScimAuthorized, parseScimUser } from "@/lib/scim/scim"
import { checkAnonymousRateLimit, getTrustedClientIp, type AnonRateLimitClient } from "@/lib/rate-limit-anon"

export const dynamic = "force-dynamic"

async function scimQuota(req: NextRequest, svc: AnonRateLimitClient): Promise<boolean> {
  const ip = getTrustedClientIp(req.headers)
  const quota = await checkAnonymousRateLimit(svc, `scim:${ip}`, 60, 3600)
  return quota.allowed
}

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function isActive(user: { banned_until?: string | null }): boolean {
  if (!user.banned_until) return true
  return new Date(user.banned_until).getTime() <= Date.now()
}

export async function GET(req: NextRequest) {
  if (!isScimAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const svc = service()
  if (!svc) return NextResponse.json({ error: "Service not configured" }, { status: 500 })
  if (!(await scimQuota(req, svc as unknown as AnonRateLimitClient))) return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  const { data, error } = await svc.auth.admin.listUsers({ page: 1, perPage: 100 })
  if (error) return NextResponse.json({ error: "Could not list users." }, { status: 500 })
  const resources = (data.users ?? []).map((u) => ({
    id: u.id,
    userName: u.email ?? "",
    active: isActive(u),
  }))
  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: resources.length,
    Resources: resources,
  })
}

export async function POST(req: NextRequest) {
  if (!isScimAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const svc = service()
  if (!svc) return NextResponse.json({ error: "Service not configured" }, { status: 500 })
  if (!(await scimQuota(req, svc as unknown as AnonRateLimitClient))) return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  const parsed = parseScimUser(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { email, active, displayName } = parsed.user
  const { data, error } = await svc.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName ?? undefined, provisioned_via: "scim" },
    ban_duration: active ? "none" : "876000h",
  })
  if (error) {
    if (/already exists|already been registered/i.test(error.message)) {
      return NextResponse.json({ error: "User already exists." }, { status: 409 })
    }
    return NextResponse.json({ error: "Could not create user." }, { status: 500 })
  }
  try {
    await svc.from("activity_events").insert({
      type: "scim_user_provisioned",
      details: { user_id: data.user.id, email, active },
    })
  } catch {
    // Audit best-effort.
  }
  return NextResponse.json(
    {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: data.user.id,
      userName: data.user.email ?? email,
      active,
    },
    { status: 201 }
  )
}
