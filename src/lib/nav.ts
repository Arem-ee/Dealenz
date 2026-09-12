import type { ComponentType } from "react"
import { LayoutDashboard, MessageCircle, CreditCard, Users, Shapes, Flag, History, Settings } from "lucide-react"
import { IconDeal } from "@/components/icons"

export interface NavEntry {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
}

/**
 * Single customer information architecture. Desktop sidebar, mobile bottom
 * bar, and top-nav titles all render from here — the three surfaces can no
 * longer drift apart.
 *
 * Primary (always visible): Home, Deals, Ask, Billing.
 * Secondary (progressively disclosed): Clients, Templates, Risk Intelligence.
 * Account (avatar menu / More sheet): Activity, Settings, Lawyer workspace.
 */
export const PRIMARY_NAV: NavEntry[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Deals", href: "/deals", icon: IconDeal },
  { label: "Ask", href: "/ask", icon: MessageCircle },
  { label: "Billing", href: "/billing", icon: CreditCard },
]

export const SECONDARY_NAV: NavEntry[] = [
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Templates", href: "/templates", icon: Shapes },
  { label: "Risk Intelligence", href: "/risk-intelligence", icon: Flag },
]

export const ACCOUNT_NAV: NavEntry[] = [
  { label: "Activity", href: "/dashboard/activity", icon: History },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
]

/** True when the pathname belongs to the entry (covers nested routes). */
export function isActiveEntry(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

/** Human title for any customer route, used by the top bar. */
export function titleFor(pathname: string): string {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard")) return "Home"
  if (pathname.startsWith("/audit")) return "Deal"
  if (pathname.startsWith("/deals")) return "Deals"
  if (pathname.startsWith("/ask")) return "Ask"
  if (pathname.startsWith("/billing")) return "Billing"
  if (pathname.startsWith("/clients")) return "Clients"
  if (pathname.startsWith("/templates")) return "Templates"
  if (pathname.startsWith("/risk-intelligence")) return "Risk Intelligence"
  if (pathname.startsWith("/lawyer")) return "Lawyer workspace"
  if (pathname.startsWith("/admin")) return "Control"
  if (pathname.startsWith("/sign")) return "Signing"
  return "Dealenz"
}
