import type { ComponentType } from "react"
import { CalendarClock, FileText, Inbox, LayoutDashboard, PenLine, ScrollText, Settings, ReceiptText, LifeBuoy } from "lucide-react"

export interface NavEntry {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
}

/**
 * Navigation is rebuilt tab by tab — entries return here as each tab is
 * built. Tab 1: Home. Tab 2: Inbox. Tab 3: Drafts. Tab 4: Signing.
 * Tab 5: Tracker. Tab 6: Clauses. The account menu lives solely in the
 * top bar.
 */
export const PRIMARY_NAV: NavEntry[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Drafts", href: "/drafts", icon: FileText },
  { label: "Signing", href: "/signing", icon: PenLine },
  { label: "Tracker", href: "/tracker", icon: CalendarClock },
  { label: "Clauses", href: "/clauses", icon: ScrollText },
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

export interface SidebarThread {
  id: string
  title: string
  updatedAt: string
  status?: string | null
  riskLevel?: string | null
}

export function threadDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Client-side filter for the navbar thread search (bounded server list). */
export function filterThreads(threads: SidebarThread[], query: string, limit = 8): SidebarThread[] {
  const q = query.trim().toLowerCase()
  if (!q) return threads.slice(0, limit)
  return threads.filter((t) => (t.title || "").toLowerCase().includes(q)).slice(0, limit)
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
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard")) return "Deal analysis"
  if (pathname.startsWith("/chat")) return "Chat"
  if (pathname.startsWith("/document")) return "Document"
  if (pathname.startsWith("/review")) return "Review"
  if (pathname.startsWith("/audit")) return "Deal"
  // /deals redirects to /dashboard, so it titles as Home rather than a
  // separate destination. No /clients surface exists (the product has no CRM).
  if (pathname.startsWith("/deals")) return "Home"
  if (pathname.startsWith("/library") || pathname.startsWith("/vault")) return "Library"
  if (pathname.startsWith("/inbox")) return "Inbox"
  if (pathname.startsWith("/drafts")) return "Drafts"
  if (pathname.startsWith("/signing")) return "Signing"
  if (pathname.startsWith("/guarded")) return "Tracker"
  if (pathname.startsWith("/settings")) return "Settings"
  if (pathname.startsWith("/billing")) return "Billing"
  if (pathname === "/help") return "Get help"
  if (pathname.startsWith("/risk-intelligence")) return "Risk Intelligence"
  if (pathname.startsWith("/lawyer")) return "Lawyer workspace"
  if (pathname.startsWith("/admin")) return "Control"
  if (pathname.startsWith("/sign")) return "Signing"
  return "Dealenz"
}
