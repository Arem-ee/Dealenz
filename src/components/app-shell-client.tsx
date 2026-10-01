"use client"

import { SidebarNav } from "@/components/sidebar-nav"
import { TopNavbar } from "@/components/top-navbar"
import { BackBar } from "@/components/back-bar"
import { VerificationBanner } from "@/components/verification-banner"
import type { SidebarThread } from "@/lib/nav"

// Fixed chrome: the top bar is always pinned to the top (search centered),
// and the sidebar icon rail is always visible — it widens to full labels on
// hover. No hover-reveal zones, so no stray trigger strips can overlap page
// content. Mobile navigates from the top navbar drawer.
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
   * The top bar stays pinned — wayfinding home never disappears.
   */
  bare?: boolean
}) {
  return (
    // Definite viewport height (not min-height): every flex-1 descendant
    // resolves against exactly 100dvh, so scrollable regions (message
    // lists, panels) scroll internally instead of growing the document.
    // Taller pages overflow visibly and the document scrolls as normal.
    <div className="flex h-dvh flex-col bg-background">
      {/* Fixed top bar: always visible on mobile and desktop. */}
      <TopNavbar
        email={email}
        businessName={businessName}
        isLawyer={isLawyer}
        creditBalance={creditBalance}
        threads={threads}
      />

      <div className="flex min-h-0 flex-1">
        {/* Fixed icon rail: icons always visible, expands to full labels
            on hover (see SidebarNav). Desktop only; mobile navigates from
            the top navbar drawer. */}
        {!bare && (
          <SidebarNav openIssues={openIssues} creditBalance={creditBalance} threads={threads} />
        )}
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          {/* Single scroll authority: the shell frame never scrolls the
              document — every page owns exactly one internal scroll region,
              so nested double scrollbars cannot form. */}
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <VerificationBanner />
            <BackBar />
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
