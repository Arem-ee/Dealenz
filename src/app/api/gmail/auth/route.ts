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
  // State is HMAC-signed and time-limited (10m) to prevent CSRF and tampering.
  // Keyed ONLY by the dedicated GMAIL_OAUTH_STATE_SECRET; a missing secret
  // fails closed here (no redirect, no fallback key).
  let state: string
  try {
    const { signGmailOAuthState } = await import("@/lib/gmail/oauth-state")
    state = encodeURIComponent(signGmailOAuthState(user.id))
  } catch {
    return NextResponse.json({ error: "Gmail not configured" }, { status: 500 })
  }
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`
  return NextResponse.redirect(url)
}
