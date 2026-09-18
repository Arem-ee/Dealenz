// Google identity-linking helpers (Phase 22, Sub-phase A).
//
// Pure, client-safe helpers for the explicit account-linking flow. Linking
// attaches a Google identity to the already-authenticated canonical
// auth.users row via Supabase's linkIdentity primitive — never by comparing
// email strings, never by rewriting user_id values.

export const LINK_FLOW_PARAM = "flow"
export const LINK_FLOW_VALUE = "link"

// Canonical post-link destination (top-level Settings container).
export const SETTINGS_PATH = "/settings"

// Fixed callback path for the link flow. The client prefixes
// window.location.origin; the path itself is server-owned, never
// attacker-controlled.
export const LINK_CALLBACK_PATH = "/auth/callback?flow=link&next=/settings"

// Internal destinations the OAuth callback may redirect to. Anything else
// (external origins, protocol-relative URLs, javascript:/data:) falls back
// to /dashboard. Keep in sync with actual app routes.
const ALLOWED_NEXT_PATHS = new Set([
  "/dashboard",
  "/settings",
  "/dashboard/activity",
  "/chat",
  "/vault",
  "/library",
  "/billing",
  "/audit/new",
  "/lawyer-application",
  "/lawyer-application/status",
])

export function resolveNextPath(next: unknown): string {
  if (typeof next !== "string") return "/dashboard"
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard"
  // Reject encoded tricks that decode to external/protocol-relative targets.
  let decoded = next
  try {
    decoded = decodeURIComponent(next)
  } catch {
    return "/dashboard"
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/dashboard"
  if (/^\/[a-zA-Z0-9/_.-]*$/.test(decoded) === false) return "/dashboard"
  const base = decoded.split("?")[0].split("#")[0]
  if (!ALLOWED_NEXT_PATHS.has(base)) return "/dashboard"
  return decoded
}

export function isLinkFlow(searchParams: { get: (key: string) => string | null }): boolean {
  return searchParams.get(LINK_FLOW_PARAM) === LINK_FLOW_VALUE
}
