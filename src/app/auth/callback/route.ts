import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isLinkFlow, resolveNextPath, SETTINGS_PATH } from "@/lib/auth/link"

function failure(req: NextRequest, forLinkFlow: boolean): NextResponse {
  // Generic failure in both flows: never reveal whether an account,
  // identity, or email exists.
  const target = forLinkFlow ? `${SETTINGS_PATH}?error=link_failed` : "/login?error=auth_failed"
  return NextResponse.redirect(new URL(target, req.url))
}

interface IdentityShape {
  provider?: unknown
  identity_data?: unknown
}

function findGoogleIdentity(user: { identities?: unknown }): IdentityShape | null {
  if (!Array.isArray(user.identities)) return null
  for (const identity of user.identities as IdentityShape[]) {
    if (identity.provider === "google") return identity
  }
  return null
}

// A Google identity counts as verified only when the provider data says so,
// or when its email matches the already-confirmed account email. Client
// input is never consulted.
function isGoogleIdentityVerified(
  identity: IdentityShape,
  user: { email?: string | null; email_confirmed_at?: string | null }
): boolean {
  const data = (identity.identity_data ?? {}) as Record<string, unknown>
  if (data.email_verified === true) return true
  const identityEmail = typeof data.email === "string" ? data.email.toLowerCase() : null
  const accountEmail = typeof user.email === "string" ? user.email.toLowerCase() : null
  return identityEmail !== null && identityEmail === accountEmail && user.email_confirmed_at != null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const forLinkFlow = isLinkFlow(searchParams)
  const next = resolveNextPath(searchParams.get("next") ?? (forLinkFlow ? SETTINGS_PATH : "/dashboard"))

  if (!code) {
    return failure(req, forLinkFlow)
  }

  const supabase = await createClient()

  if (forLinkFlow) {
    // Explicit linking must start from an authenticated account. Capture the
    // initiating identity BEFORE exchanging the code so the result can be
    // bound to it afterwards.
    const { data: { user: beforeUser } } = await supabase.auth.getUser()
    if (!beforeUser) {
      return failure(req, true)
    }
    const beforeId = beforeUser.id

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return failure(req, true)
    }

    const { data: { user: afterUser } } = await supabase.auth.getUser()
    if (!afterUser || afterUser.id !== beforeId) {
      // Session changed accounts mid-flow: refuse to treat this as a link.
      return failure(req, true)
    }

    const googleIdentity = findGoogleIdentity(afterUser)
    if (!googleIdentity || !isGoogleIdentityVerified(googleIdentity, afterUser)) {
      return failure(req, true)
    }

    return NextResponse.redirect(new URL(next, req.url))
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, req.url))
    }
  }

  return failure(req, false)
}
