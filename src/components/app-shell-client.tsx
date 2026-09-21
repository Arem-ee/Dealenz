"use client"

import { useCallback, useEffect, useState } from "react"
import { Menu } from "lucide-react"
import { SidebarNav } from "@/components/sidebar-nav"
import { TopNavbar } from "@/components/top-navbar"
import { MobileNav } from "@/components/mobile-nav"
import { BackBar } from "@/components/back-bar"
import { VerificationBanner } from "@/components/verification-banner"
import type { SidebarThread } from "@/lib/nav"

// Collapsible app chrome: the sidebar and the top bar each collapse to give
// the deal workspace full width. State persists per browser in localStorage,
// applied after mount so the first render always matches the server HTML
// (reading storage during render would break hydration).
const SIDEBAR_KEY = "dealenz.chrome.sidebar-open"
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [topbarVisible, setTopbarVisible] = useState(true)

  useEffect(() => {
    setSidebarOpen(readStored(SIDEBAR_KEY, true))
    setTopbarVisible(readStored(TOPBAR_KEY, true))
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      store(SIDEBAR_KEY, !prev)
      return !prev
    })
  }, [])

  const toggleTopbar = useCallback(() => {
    setTopbarVisible((prev) => {
      store(TOPBAR_KEY, !prev)
      return !prev
    })
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {topbarVisible ? (
        <TopNavbar
          email={email}
          businessName={businessName}
          isLawyer={isLawyer}
          creditBalance={creditBalance}
          threads={threads}
          onToggleSidebar={toggleSidebar}
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
        {sidebarOpen && <SidebarNav openIssues={openIssues} creditBalance={creditBalance} onCollapse={toggleSidebar} flushTop={!topbarVisible} />}
        <div className="flex flex-1 flex-col min-w-0 bg-background">
          <main className="flex flex-1 flex-col min-h-0 pb-16 md:pb-0 bg-background">
            <VerificationBanner />
            <BackBar />
            <div className="flex flex-1 flex-col min-h-0">{children}</div>
          </main>
        </div>
        <MobileNav isLawyer={isLawyer} />
      </div>
    </div>
  )
}
