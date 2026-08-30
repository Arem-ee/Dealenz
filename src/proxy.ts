import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { logEventWithClient } from "@/lib/logger"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  )

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

  if (user && pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    await logEventWithClient(supabase, {
      phase: "auth_redirect",
      status: "success",
      error_message: "Authenticated user redirected to /dashboard",
    })
    return NextResponse.redirect(url)
  }

  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/audit") || pathname.startsWith("/deals") || pathname.startsWith("/clients") || pathname.startsWith("/risk-intelligence") || pathname.startsWith("/templates") || pathname.startsWith("/billing")) && !pathname.startsWith("/view")) {
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
