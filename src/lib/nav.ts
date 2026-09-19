import type { ComponentType } from "react"
import { LayoutDashboard, Settings, Library, ReceiptText, LifeBuoy } from "lucide-react"

export interface NavEntry {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
}

/**
 * Single customer information architecture — chat-first.
 * Home is the chat landing (composer + desktop sidebar thread list; the
 * recent-threads box survives only on mobile where there is no sidebar).
 * Library is natural-language search over the user's deals with structured
 * results. Ask is just the composer (classifier), not a destination.
 * The sidebar holds the two primary items, the scrollable thread list, and
 * the account dropdown at the bottom; everything account-level lives in
 * that dropdown.
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

/**
 * Shell back-button target for one-level-deep routes. Returns the fallback
 * href when the route warrants a shell-level back control, null for section
 * roots (covered by the sidebar) and for deep routes that already carry
 * their own in-component back links (Document Reader, Review).
 */
export function backTargetFor(pathname: string): string | null {
  if (/^\/chat\/[^/]+$/.test(pathname)) return "/dashboard"
  return null
}

/** Human title for any customer route, used by the top bar. */
export function titleFor(pathname: string): string {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard")) return "Home"
  if (pathname.startsWith("/chat")) return "Chat"
  if (pathname.startsWith("/document")) return "Document"
  if (pathname.startsWith("/review")) return "Review"
  if (pathname.startsWith("/audit")) return "Deal"
  // /deals redirects to /dashboard, so it titles as Home rather than a
  // separate destination. No /clients surface exists (the product has no CRM).
  if (pathname.startsWith("/deals")) return "Home"
  if (pathname.startsWith("/library") || pathname.startsWith("/vault")) return "Library"
  if (pathname.startsWith("/settings")) return "Settings"
  if (pathname.startsWith("/billing")) return "Billing"
  if (pathname === "/help") return "Get help"
  if (pathname.startsWith("/templates")) return "Templates"
  if (pathname.startsWith("/risk-intelligence")) return "Risk Intelligence"
  if (pathname.startsWith("/lawyer")) return "Lawyer workspace"
  if (pathname.startsWith("/admin")) return "Control"
  if (pathname.startsWith("/sign")) return "Signing"
  return "Dealenz"
}
