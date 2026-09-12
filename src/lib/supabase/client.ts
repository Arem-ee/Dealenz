import { createBrowserClient } from "@supabase/ssr"
import { supabasePublicConfig } from "@/lib/config"

export function createClient() {
  const { url, anonKey } = supabasePublicConfig()
  return createBrowserClient(url, anonKey)
}
