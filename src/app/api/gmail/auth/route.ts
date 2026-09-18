import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Initiates Google OAuth for Gmail — separate from Google Sign-In (authentication only)
// Gmail is optional, contextual, used only when sending/observing replies.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/gmail/callback`
  if (!clientId) return NextResponse.json({ error: "Gmail not configured" }, { status: 500 })

  const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly")
  // State is HMAC-signed and time-limited (10m) to prevent CSRF and tampering. Requires GOOGLE_CLIENT_SECRET as HMAC key.
  const { createHmac, randomUUID } = await import("node:crypto")
  const hmacKey = process.env.GOOGLE_CLIENT_SECRET ?? process.env.GMAIL_OAUTH_STATE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-state-key"
  const payload = JSON.stringify({ userId: user.id, nonce: randomUUID(), ts: Date.now() })
  const sig = createHmac("sha256", hmacKey).update(payload).digest("base64url")
  const state = encodeURIComponent(Buffer.from(payload, "utf8").toString("base64url") + "." + sig)
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`
  return NextResponse.redirect(url)
}
