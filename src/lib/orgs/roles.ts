// Organization roles: owner > admin > member > viewer. Pure hierarchy
// helpers; enforcement lives in the 00091 RPCs (server-side) and RLS.
export const ORG_ROLES = ["owner", "admin", "member", "viewer"] as const

export type OrgRole = (typeof ORG_ROLES)[number]

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === "string" && (ORG_ROLES as readonly string[]).includes(value)
}

export function canInvite(acting: OrgRole, target: Exclude<OrgRole, "owner">): boolean {
  if (acting === "owner") return true
  if (acting === "admin") return target === "member" || target === "viewer"
  return false
}

export function canRemove(acting: OrgRole, target: OrgRole, self: boolean): boolean {
  if (self) return true
  if (acting === "owner") return true
  if (acting === "admin") return target === "member" || target === "viewer"
  return false
}

export function canManageBilling(role: OrgRole): boolean {
  return role === "owner" || role === "admin"
}
