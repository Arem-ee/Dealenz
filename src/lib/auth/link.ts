// Google identity-linking helpers (Phase 22, Sub-phase A).
//
// Pure, client-safe helpers for the explicit account-linking flow. Linking
// attaches a Google identity to the already-authenticated canonical
// auth.users row via Supabase's linkIdentity primitive — never by comparing
// email strings, never by rewriting user_id values.

export const LINK_FLOW_PARAM = "flow"
export const LINK_FLOW_VALUE = "link"

// Canonical post-link destination. The app UI was wiped in the rebuild;
// authenticated users land on the landing page until app tabs return.
export const SETTINGS_PATH = "/"

// Fixed callback path for the link flow. The client prefixes
// window.location.origin; the path itself is server-owned, never
// attacker-controlled.
export const LINK_CALLBACK_PATH = "/auth/callback?flow=link&next=/"

// Internal destinations the OAuth callback may redirect to. Anything else
// (external origins, protocol-relative URLs, javascript:/data:) falls back
// to /. Keep in sync with actual app routes.
const ALLOWED_NEXT_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/pricing",
  "/help",
])

export function resolveNextPath(next: unknown): string {
  if (typeof next !== "string") return "/"
  if (!next.startsWith("/") || next.startsWith("//")) return "/"
  // Reject encoded tricks that decode to external/protocol-relative targets.
  let decoded = next
  try {
    decoded = decodeURIComponent(next)
  } catch {
    return "/"
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/"
  if (/^\/[a-zA-Z0-9/_.-]*$/.test(decoded) === false) return "/"
  const base = decoded.split("?")[0].split("#")[0]
  if (!ALLOWED_NEXT_PATHS.has(base)) return "/"
  return decoded
}

export function isLinkFlow(searchParams: { get: (key: string) => string | null }): boolean {
  return searchParams.get(LINK_FLOW_PARAM) === LINK_FLOW_VALUE
}
