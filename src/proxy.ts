import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { logEventWithClient } from "@/lib/logger"
import { supabasePublicConfig } from "@/lib/config"
import { LOCALE_COOKIE, isLocale, negotiateLocale } from "@/lib/i18n/locale"

// First-visit locale seeding. Explicit choices win by construction: this
// only fires when the cookie is absent or invalid, so Settings always
// overrides it. Signed-in users reseed from the profile (one read, only
// when the cookie is missing) so a new device picks up their language;
// everyone else negotiates from Accept-Language. Applied to every
// response, including redirects. Best-effort — never breaks auth flow.
async function seedLocaleCookie(
  request: NextRequest,
  response: NextResponse,
  userId: string | null
): Promise<NextResponse> {
  const current = request.cookies.get(LOCALE_COOKIE)?.value
  if (isLocale(current)) return response
  let locale = negotiateLocale(request.headers.get("accept-language"))
  if (userId) {
    try {
      const { url, anonKey } = supabasePublicConfig()
      const { createServerClient: createClient } = await import("@supabase/ssr")
      const supabase = createClient(url, anonKey, {
        cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined },
      })
      const { data } = await supabase
        .from("business_profiles")
        .select("locale")
        .eq("user_id", userId)
        .maybeSingle()
      const stored = (data as { locale?: unknown } | null)?.locale
      if (isLocale(stored)) locale = stored
    } catch {
      // Browser-negotiated locale stands.
    }
  }
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 365 * 86_400,
    sameSite: "lax",
  })
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({ request })

  const { url, anonKey } = supabasePublicConfig()
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  let user: { id: string } | null = null
  try {
    await supabase.auth.getSession()
  } catch (error) {
    await logEventWithClient(supabase, {
      phase: "auth_session_refresh",
      status: "failure",
      error_message: error instanceof Error ? error.message : "Unknown error",
    })
  }

  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (error) {
    await logEventWithClient(supabase, {
      phase: "auth_get_user",
      status: "failure",
      error_message: error instanceof Error ? error.message : "Unknown error",
    })
  }

  // No app routes survive the wipe except landing + auth, so there is
  // nothing to guard: public pages and API routes (which authenticate
  // themselves, including the billing webhooks) pass straight through.
  // The only redirect left keeps signed-in users off the auth pages.
  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    await logEventWithClient(supabase, {
      phase: "auth_redirect",
      status: "success",
      error_message: "Authenticated user redirected to /",
    })
    return seedLocaleCookie(request, NextResponse.redirect(url), user ? user.id : null)
  }

  // App routes return tab by tab with the rebuild; each guarded prefix is
  // added here as its tab lands. API routes authenticate themselves.
  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/inbox") || pathname.startsWith("/drafts") || pathname.startsWith("/signing") || pathname.startsWith("/tracker") || pathname.startsWith("/clauses") || pathname.startsWith("/templates") || pathname.startsWith("/compare") || pathname.startsWith("/approvals") || pathname.startsWith("/reports") || pathname.startsWith("/lab") || pathname.startsWith("/team") || pathname.startsWith("/chat") || pathname.startsWith("/settings"))) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    await logEventWithClient(supabase, {
      phase: "auth_redirect",
      status: "success",
      error_message: "Unauthenticated user redirected to /login",
    })
    return seedLocaleCookie(request, NextResponse.redirect(url), null)
  }

  return seedLocaleCookie(request, supabaseResponse, user ? user.id : null)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
