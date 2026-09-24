"use client"

import { useCallback, useEffect, useState } from "react"
import { Menu } from "lucide-react"
import { SidebarNav } from "@/components/sidebar-nav"
import { TopNavbar } from "@/components/top-navbar"
import { BackBar } from "@/components/back-bar"
import { VerificationBanner } from "@/components/verification-banner"
import type { SidebarThread } from "@/lib/nav"

// Collapsible top bar only: the sidebar is a hover-expand rail with no
// manual hide (the standard auto-rail pattern), so its visibility is never
// stored. Top-bar preference persists per browser in localStorage, applied
// after mount so the first render always matches the server HTML (reading
// storage during render would break hydration).
const TOPBAR_KEY = "dealenz.chrome.topbar-visible"

function readStored(key: string, fallback: boolean): boolean {
  try {
    if (typeof window === "undefined") return fallback
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return raw !== "0"
  } catch {
    return fallback
  }
}

function store(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0")
  } catch {
    // Private mode: preference simply does not persist.
  }
}

export function ChromeShell({
  children,
  email,
  businessName,
  isLawyer,
  creditBalance,
  threads,
  openIssues,
}: {
  children: React.ReactNode
  email: string
  businessName?: string | null
  isLawyer?: boolean
  creditBalance?: number | null
  threads?: SidebarThread[]
  openIssues?: number
}) {
  // Post-mount chrome restore (not derived state): reading storage during
  // render would break hydration, so the first render always matches the
  // server HTML and stored prefs apply after mount.
  const [topbarVisible, setTopbarVisible] = useState(true)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTopbarVisible(readStored(TOPBAR_KEY, true))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const toggleTopbar = useCallback(() => {
    setTopbarVisible((prev) => {
      store(TOPBAR_KEY, !prev)
      return !prev
    })
  }, [])

  return (
    // Definite viewport height (not min-height): every flex-1 descendant
    // resolves against exactly 100dvh, so scrollable regions (message
    // lists, panels) scroll internally instead of growing the document.
    // Taller pages overflow visibly and the document scrolls as normal.
    <div className="flex h-dvh flex-col bg-background">
      {topbarVisible ? (
        <TopNavbar
          email={email}
          businessName={businessName}
          isLawyer={isLawyer}
          creditBalance={creditBalance}
          threads={threads}
          onHideTopbar={toggleTopbar}
        />
      ) : (
        <button
          type="button"
          onClick={toggleTopbar}
          aria-label="Show header"
          title="Show header"
          className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/90 shadow-sm backdrop-blur transition-colors hover:bg-muted/80"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}
      <div className="flex flex-1 min-h-0">
        <SidebarNav openIssues={openIssues} creditBalance={creditBalance} threads={threads} flushTop={!topbarVisible} />
        <div className="flex flex-1 flex-col min-w-0 bg-background">
          {/* No bottom tab bar: mobile nav lives in the top navbar drawer,
              so no pb-16 compensation is needed and the composer pins cleanly. */}
          <main className="flex flex-1 flex-col min-h-0 bg-background">
            <VerificationBanner />
            <BackBar />
            <div className="flex flex-1 flex-col min-h-0">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
