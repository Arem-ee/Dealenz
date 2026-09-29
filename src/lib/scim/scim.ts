import { timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"

// SCIM-lite: the smallest surface that lets an IdP own the employee
// lifecycle (provision on hire, suspend on exit) without manual admin work.
// Full SCIM (schemas, groups, pagination tokens) is out of scope; this
// speaks just enough SCIM 2.0 for Okta/Azure AD provisioning connectors:
//   GET  /api/scim/users          list id, email, active
//   POST /api/scim/users          create (invites by email)
//   PATCH /api/scim/users/[id]    set active true/false (ban, never delete)
// DELETE is refused: deleting a user cascades their deals. Exits suspend.
// Auth is a provision token (SCIM_PROVISION_TOKEN) compared timing-safe.
// Unset token fails closed everywhere, including development: there is no
// safe default for a user-creating endpoint.
// Every admin mutation is also recorded in Supabase's own auth audit log.

export function scimTokenConfigured(): boolean {
  return typeof process.env.SCIM_PROVISION_TOKEN === "string" && process.env.SCIM_PROVISION_TOKEN.length >= 32
}

export function isScimAuthorized(req: NextRequest): boolean {
  const configured = process.env.SCIM_PROVISION_TOKEN
  if (!configured || configured.length < 32) return false
  const header = req.headers.get("authorization") ?? ""
  const presented = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!presented) return false
  const a = Buffer.from(presented, "utf8")
  const b = Buffer.from(configured, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export interface ScimUserInput {
  email: string
  active: boolean
  displayName: string | null
}

function pickEmail(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null
  const record = value as Record<string, unknown>
  const candidates = [record.userName, record.email]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.includes("@")) return candidate.trim().toLowerCase()
  }
  const emails = record.emails
  if (Array.isArray(emails)) {
    for (const entry of emails) {
      if (typeof entry === "object" && entry !== null && typeof (entry as Record<string, unknown>).value === "string") {
        const address = ((entry as Record<string, unknown>).value as string).trim().toLowerCase()
        if (address.includes("@")) return address
      }
    }
  }
  return null
}

export function parseScimUser(body: unknown): { ok: true; user: ScimUserInput } | { ok: false; error: string } {
  const email = pickEmail(body)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "A valid userName or email is required." }
  }
  const record = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>
  const active = typeof record.active === "boolean" ? record.active : true
  const name = record.displayName ?? record.name
  const displayName =
    typeof name === "string" && name.trim()
      ? name.trim().slice(0, 120)
      : typeof name === "object" && name !== null && typeof (name as Record<string, unknown>).formatted === "string"
        ? ((name as Record<string, unknown>).formatted as string).trim().slice(0, 120)
        : null
  return { ok: true, user: { email, active, displayName: displayName || null } }
}

export function parseScimActive(body: unknown): { ok: true; active: boolean } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "An active boolean is required." }
  const record = body as Record<string, unknown>
  const operations = record.Operations
  if (Array.isArray(operations)) {
    for (const op of operations) {
      if (typeof op !== "object" || op === null) continue
      const path = (op as Record<string, unknown>).path
      const value = (op as Record<string, unknown>).value
      if (typeof path === "string" && path.toLowerCase() === "active" && typeof value === "boolean") {
        return { ok: true, active: value }
      }
    }
    return { ok: false, error: "No active patch operation found." }
  }
  if (typeof record.active === "boolean") return { ok: true, active: record.active }
  return { ok: false, error: "An active boolean is required." }
}
