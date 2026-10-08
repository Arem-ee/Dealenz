// Guest grant validation — pure helpers for the external surface (D4/D9).
//
// One surface, audience-typed grants: employee / supplier / customer,
// scoped reader (view) or uploader (the single primary owner per deal who
// may upload redlines back staged). Guests are token principals, never
// members — invitation-only, no self-registration.

export type GuestAudience = "employee" | "supplier" | "customer"

export const GUEST_AUDIENCES: readonly GuestAudience[] = ["employee", "supplier", "customer"]

export function isGuestAudience(raw: unknown): raw is GuestAudience {
  return raw === "employee" || raw === "supplier" || raw === "customer"
}

export type GuestScope = "reader" | "uploader"

export function isGuestScope(raw: unknown): raw is GuestScope {
  return raw === "reader" || raw === "uploader"
}

export function audienceLabel(audience: GuestAudience): string {
  if (audience === "employee") return "Employee"
  if (audience === "supplier") return "Supplier"
  return "Customer"
}

/** Normalized lowercase email, or null when malformed. */
export function normalizeGuestEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const email = raw.trim().toLowerCase()
  if (email.length < 3 || email.length > 254) return null
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) return null
  return email
}

/** Portal link path for a grant token. The token travels in the URL, never in logs. */
export function guestPortalPath(token: string): string {
  return `/guest/${token}`
}
