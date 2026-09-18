import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { upsertGmailTokens } from "@/lib/gmail/tokens"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/login", req.url))

  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 })
  if (!state) return NextResponse.json({ error: "Missing state" }, { status: 400 })

  try {
    const { createHmac } = await import("node:crypto")
    const hmacKey = process.env.GOOGLE_CLIENT_SECRET ?? process.env.GMAIL_OAUTH_STATE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-state-key"
    const decoded = Buffer.from(decodeURIComponent(state).split(".")[0] ?? "", "base64url").toString("utf8")
    const sig = decodeURIComponent(state).split(".")[1] ?? ""
    const expected = createHmac("sha256", hmacKey).update(decoded).digest("base64url")
    // timingSafeEqual would require equal length; simple compare with constant time via createHmac check
    if (sig.length !== expected.length) return NextResponse.json({ error: "Invalid state" }, { status: 400 })
    const { timingSafeEqual } = await import("node:crypto")
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 })
    }
    const parsed = JSON.parse(decoded) as { userId?: string; ts?: number; nonce?: string }
    if (!parsed?.userId || parsed.userId !== user.id) return NextResponse.json({ error: "State mismatch" }, { status: 400 })
    if (!parsed.ts || Date.now() - parsed.ts > 10 * 60 * 1000) return NextResponse.json({ error: "State expired" }, { status: 400 })
    // single-use could be enforced via storing nonce in gmail_oauth_states, but expiry + HMAC suffices for CSRF
  } catch {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/gmail/callback`
  if (!clientId || !clientSecret) return NextResponse.json({ error: "Gmail not configured" }, { status: 500 })

  // Exchange code for tokens (server-side, never browser)
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })
  const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string }
  if (!tokens.access_token || !tokens.refresh_token) return NextResponse.json({ error: "Failed to obtain Gmail tokens" }, { status: 500 })

  const expiryDate = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()
  await upsertGmailTokens(supabase as never, user.id, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: expiryDate,
    scope: tokens.scope,
    token_type: tokens.token_type,
  })

  return NextResponse.redirect(new URL("/settings?gmail=connected", req.url))
}
