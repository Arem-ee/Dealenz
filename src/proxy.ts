import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { logEventWithClient } from "@/lib/logger"
import { supabasePublicConfig } from "@/lib/config"

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

  let user = null
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
    return NextResponse.redirect(url)
  }

  // App routes return tab by tab with the rebuild; each guarded prefix is
  // added here as its tab lands. API routes authenticate themselves.
  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/inbox") || pathname.startsWith("/drafts") || pathname.startsWith("/signing") || pathname.startsWith("/tracker") || pathname.startsWith("/clauses") || pathname.startsWith("/templates") || pathname.startsWith("/compare") || pathname.startsWith("/approvals") || pathname.startsWith("/reports"))) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    await logEventWithClient(supabase, {
      phase: "auth_redirect",
      status: "success",
      error_message: "Unauthenticated user redirected to /login",
    })
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
