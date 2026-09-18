import type { ComponentType } from "react"
import { LayoutDashboard, Settings, Library, ReceiptText, LifeBuoy } from "lucide-react"

export interface NavEntry {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
}

/**
 * Single customer information architecture — chat-first.
 * Home is the chat landing (composer + recent threads). Library is
 * natural-language search over the user's deals with structured results.
 * Ask is just the composer (classifier), not a destination.
 * The sidebar holds only these two primary items; everything account-level
 * lives in the account dropdown at the bottom.
 */
export const PRIMARY_NAV: NavEntry[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Library", href: "/library", icon: Library },
]

export const SECONDARY_NAV: NavEntry[] = []

export const ACCOUNT_NAV: NavEntry[] = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Billing", href: "/billing", icon: ReceiptText },
  { label: "Get help", href: "/help", icon: LifeBuoy },
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
  if (pathname.startsWith("/library") || pathname.startsWith("/vault")) return "Library"
  if (pathname.startsWith("/settings")) return "Settings"
  if (pathname.startsWith("/billing")) return "Billing"
  if (pathname === "/help") return "Get help"
  if (pathname.startsWith("/clients")) return "Clients"
  if (pathname.startsWith("/templates")) return "Templates"
  if (pathname.startsWith("/risk-intelligence")) return "Risk Intelligence"
  if (pathname.startsWith("/lawyer")) return "Lawyer workspace"
  if (pathname.startsWith("/admin")) return "Control"
  if (pathname.startsWith("/sign")) return "Signing"
  return "Dealenz"
}
