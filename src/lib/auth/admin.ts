// Server-controlled admin authorization (Phase 1 security hardening).
//
// The is_admin flag lives in app_metadata, which is writable only with the
// service role (dashboard or admin API) and is returned inside the
// Auth-server-signed session by getUser(). It can never be set through
// user.updateUser(), so unlike user_metadata it cannot be self-granted.
// Every check below runs server-side on a freshly verified session.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(id: unknown): boolean {
  return typeof id === "string" && UUID_RE.test(id)
}

interface SessionUser {
  id: string
  // app_metadata is server-controlled (service role only). user_metadata is
  // deliberately NOT consulted here: it is user-writable and must never
  // confer privilege.
  app_metadata?: Record<string, unknown> | null
}

/** True only for a well-formed user id whose server-verified app_metadata carries is_admin. */
export function isAdminSessionUser(user: SessionUser | null | undefined): boolean {
  if (!user || !isValidUUID(user.id)) return false
  return (user.app_metadata as Record<string, unknown> | null)?.is_admin === true
}
