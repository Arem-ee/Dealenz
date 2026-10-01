"use client"

import { TopNavbar } from "@/components/top-navbar"
import { BackBar } from "@/components/back-bar"
import { VerificationBanner } from "@/components/verification-banner"
import type { SidebarThread } from "@/lib/nav"

// Bare chrome: the top bar is pinned to the top; pages own the full width
// below it. No sidebar — navigation returns tab by tab with the rebuild.
export function ChromeShell({
  children,
  email,
  businessName,
  isLawyer = false,
  creditBalance = null,
  threads = [],
}: {
  children: React.ReactNode
  email: string
  businessName?: string | null
  isLawyer?: boolean
  creditBalance?: number | null
  threads?: SidebarThread[]
}) {
  return (
    // Definite viewport height (not min-height): every flex-1 descendant
    // resolves against exactly 100dvh, so scrollable regions (message
    // lists, panels) scroll internally instead of growing the document.
    // Taller pages overflow visibly and the document scrolls as normal.
    <div className="flex h-dvh flex-col bg-background">
      <TopNavbar
        email={email}
        businessName={businessName}
        isLawyer={isLawyer}
        creditBalance={creditBalance}
        threads={threads}
      />

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
  )
}
