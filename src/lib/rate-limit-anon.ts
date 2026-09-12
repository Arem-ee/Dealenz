// Durable anonymous rate limiting (Phase 1 security hardening).
//
// The previous limiter was an in-memory Map keyed on attacker-controlled
// headers (x-forwarded-for first entry + self-asserted x-anonymous-fp):
// rotating a header yielded a fresh bucket, and restarts/scale wiped all
// state. This module keys on a platform-derived IP and counts in Postgres
// (migration 00040, check_anonymous_rate_limit), so limits survive restarts
// and are shared across instances. Deny on error (fail-closed): a broken
// limiter must never silently become unlimited AI spend.

export interface AnonRateLimitClient {
  // PromiseLike (not Promise): the real Supabase client returns a
  // thenable query builder from rpc(); await works on both.
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>
}

// Prefer x-real-ip (set by the hosting edge to the connecting client; not
// client-controlled). Otherwise take the LAST x-forwarded-for entry: proxies
// append the connecting IP, so the last entry is platform-added while
// earlier entries may be spoofed by the client. Never use x-anonymous-fp
// (fully self-asserted) as identity.
export function getTrustedClientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim()
  if (realIp && isPlausibleIp(realIp)) return normalizeIp(realIp)
  const xff = headers.get("x-forwarded-for")?.trim()
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean)
    const last = parts[parts.length - 1]
    if (last && isPlausibleIp(last)) return normalizeIp(last)
  }
  return "unknown"
}

function normalizeIp(ip: string): string {
  // Strip an IPv4 :port suffix ("1.2.3.4:5678" -> "1.2.3.4"). IPv6 contains
  // multiple colons and is left intact. Bound length for the DB key.
  const v4port = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(ip)
  const out = (v4port ? v4port[1] : ip).toLowerCase()
  return out.slice(0, 64)
}

function isPlausibleIp(ip: string): boolean {
  if (ip.length === 0 || ip.length > 64) return false
  // IPv4 (with optional single :port) or IPv6 hex/colons/dots.
  return (
    /^\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?$/.test(ip) ||
    /^[0-9a-fA-F:.]{3,45}$/.test(ip)
  )
}

export interface AnonLimitResult {
  allowed: boolean
  currentCount: number
}

/** Durable check-and-increment. Fails closed: any RPC error denies. */
export async function checkAnonymousRateLimit(
  supabase: AnonRateLimitClient,
  key: string,
  limit: number,
  windowSeconds = 3600
): Promise<AnonLimitResult> {
  try {
    const { data, error } = await supabase.rpc("check_anonymous_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error) return { allowed: false, currentCount: 0 }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; current_count: number }
      | undefined
    if (!row || typeof row.allowed !== "boolean") return { allowed: false, currentCount: 0 }
    return { allowed: row.allowed, currentCount: row.current_count ?? 0 }
  } catch {
    return { allowed: false, currentCount: 0 }
  }
}
