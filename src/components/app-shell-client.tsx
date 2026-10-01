"use client"

import { SidebarNav } from "@/components/sidebar-nav"
import { TopNavbar } from "@/components/top-navbar"
import { BackBar } from "@/components/back-bar"
import { VerificationBanner } from "@/components/verification-banner"
import type { SidebarThread } from "@/lib/nav"

// Hover chrome: nothing visible at rest on desktop. A left-edge zone
// reveals the sidebar rail; a top-edge zone reveals the top bar with its
// search. Both stay open while hovered or keyboard-focused inside, so
// keyboard and touch users are never stranded. Mobile has no hover: the
// slim top bar (with its navigation drawer) renders always.
export function ChromeShell({
  children,
  email,
  businessName,
  isLawyer = false,
  creditBalance = null,
  threads = [],
  openIssues = 0,
  bare = false,
}: {
  children: React.ReactNode
  email: string
  businessName?: string | null
  isLawyer?: boolean
  creditBalance?: number | null
  threads?: SidebarThread[]
  openIssues?: number
  /**
   * Bare pages own the full width (no primary sidebar): routes with their
   * own internal navigation or a focused single task (settings, billing).
   * The top bar stays reachable on hover — wayfinding home never disappears.
   */
  bare?: boolean
}) {
  return (
    // Definite viewport height (not min-height): every flex-1 descendant
    // resolves against exactly 100dvh, so scrollable regions (message
    // lists, panels) scroll internally instead of growing the document.
    // Taller pages overflow visibly and the document scrolls as normal.
    <div className="flex h-dvh flex-col bg-background">
      {/* Mobile chrome: always visible, drawer-driven. */}
      <div className="md:hidden">
        <TopNavbar
          email={email}
          businessName={businessName}
          isLawyer={isLawyer}
          creditBalance={creditBalance}
          threads={threads}
        />
      </div>

      {/* Desktop hover zones. Containers ignore pointer events except the
          trigger strips and the revealed panels, so the page beneath stays
          fully interactive at rest. */}
      {!bare && (
        <div className="group/side fixed inset-y-0 left-0 z-50 hidden md:block" aria-label="Sidebar reveal zone">
          <div className="absolute inset-y-0 left-0 w-2" />
          <div className="h-full -translate-x-full transition-transform duration-200 ease-out group-hover/side:translate-x-0 group-focus-within/side:translate-x-0">
            <SidebarNav openIssues={openIssues} creditBalance={creditBalance} threads={threads} flushTop />
          </div>
        </div>
      )}
      <div className="group/top fixed inset-x-0 top-0 z-50 hidden md:block" aria-label="Top bar reveal zone">
        <div className="-translate-y-full transition-transform duration-200 ease-out group-hover/top:translate-y-0 group-focus-within/top:translate-y-0">
          <TopNavbar
            email={email}
            businessName={businessName}
            isLawyer={isLawyer}
            creditBalance={creditBalance}
            threads={threads}
          />
        </div>
        <div className="h-1.5 w-full border-b border-transparent transition-colors group-hover/top:border-border/60" />
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-1 flex-col min-w-0 bg-background">
          {/* Single scroll authority: the shell frame never scrolls the
              document — every page owns exactly one internal scroll region,
              so nested double scrollbars cannot form. */}
          <main className="flex flex-1 flex-col min-h-0 overflow-hidden bg-background">
            <VerificationBanner />
            <BackBar />
            <div className="flex flex-1 flex-col min-h-0">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
