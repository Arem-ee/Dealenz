"use server"

import { createClient } from "@/lib/supabase/server"
import { LINK_CALLBACK_PATH } from "@/lib/auth/link"

// Returns the providers linked to the current authenticated account.
// Used to render Connected/Connect Google state. Never trusts client input.
export async function getConnectedProviders(): Promise<{ success: boolean; providers?: string[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  const providers = Array.isArray(user.identities)
    ? [...new Set(user.identities.map((i) => i.provider).filter((p): p is string => typeof p === "string"))]
    : []

  return { success: true, providers }
}

// Authorizes the current authenticated user to begin explicit Google
// identity linking and returns the fixed server-owned callback path.
// The client prefixes its own origin; the path itself is never
// attacker-controlled. Unauthenticated callers are rejected here, before
// any linkIdentity call can happen.
export async function getGoogleLinkPath(): Promise<{ success: boolean; path?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  return { success: true, path: LINK_CALLBACK_PATH }
}
