import type { ComponentType } from "react"
import { LayoutDashboard, History, Settings, Vault } from "lucide-react"

export interface NavEntry {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
}

/**
 * Single customer information architecture — chat-first.
 * Home is the chat landing (composer + recent threads). Deals is folded into
 * Home (same thread list), so no separate Deals nav item. Ask is just the
 * composer (classifier), not a destination. Vault is the Vault chat.
 * Billing is inside Settings.
 */
export const PRIMARY_NAV: NavEntry[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Vault", href: "/vault", icon: Vault },
  { label: "Settings", href: "/settings", icon: Settings },
]

export const SECONDARY_NAV: NavEntry[] = []

export const ACCOUNT_NAV: NavEntry[] = [
  { label: "Activity", href: "/dashboard/activity", icon: History },
]

/** True when the pathname belongs to the entry (covers nested routes). */
export function isActiveEntry(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

/** Human title for any customer route, used by the top bar. */
export function titleFor(pathname: string): string {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard")) return "Home"
  if (pathname.startsWith("/chat")) return "Chat"
  if (pathname.startsWith("/document")) return "Document"
  if (pathname.startsWith("/review")) return "Review"
  if (pathname.startsWith("/audit")) return "Deal"
  if (pathname.startsWith("/deals")) return "Deals"
  if (pathname.startsWith("/vault")) return "Vault"
  if (pathname.startsWith("/settings")) return "Settings"
  if (pathname.startsWith("/billing")) return "Billing"
  if (pathname.startsWith("/clients")) return "Clients"
  if (pathname.startsWith("/templates")) return "Templates"
  if (pathname.startsWith("/risk-intelligence")) return "Risk Intelligence"
  if (pathname.startsWith("/lawyer")) return "Lawyer workspace"
  if (pathname.startsWith("/admin")) return "Control"
  if (pathname.startsWith("/sign")) return "Signing"
  return "Dealenz"
}
