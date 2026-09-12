import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabasePublicConfig } from "@/lib/config"

export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = supabasePublicConfig()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      },
    },
  })
}
