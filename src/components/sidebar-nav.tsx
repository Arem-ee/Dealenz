"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { PRIMARY_NAV, SECONDARY_NAV, isActiveEntry } from "@/lib/nav"

// Flux-model sidebar: navigation with live counts, plus a low-credit
// top-up card. No history list — deals live in the main table, where
// they can carry state, risk, and actions. Navigation carries state
// (badges), never decoration.
export function SidebarNav({ openIssues = 0, creditBalance = null }: { openIssues?: number; creditBalance?: number | null }) {
  const pathname = usePathname()
  const showTopUp = typeof creditBalance === "number" && creditBalance < 25

  return (
    <aside className="hidden md:flex md:flex-col w-56 border-r border-border/60 bg-background shrink-0 md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)]">
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3" aria-label="Primary">
        <div className="shrink-0 space-y-0.5">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon
            const isActive = isActiveEntry(pathname, item.href)
            const badge = item.href === "/dashboard" && openIssues > 0 ? openIssues : null
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {badge !== null && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--burgundy)] px-1.5 text-[10px] font-bold text-white" aria-label={`${badge} open issues`}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            )
          })}
          {SECONDARY_NAV.length > 0 && (
            <>
              <p className="px-3 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                Workspace
              </p>
              {SECONDARY_NAV.map((item) => {
                const Icon = item.icon
                const isActive = isActiveEntry(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </>
          )}
        </div>
        {showTopUp && (
          <div className="mt-auto shrink-0 px-1 pb-1 pt-4">
            <div className="rounded-xl bg-[#1C1917] p-4 text-white">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Zap className="h-3.5 w-3.5" />
                Low credits
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/60">
                {creditBalance} left. Top up to keep analyzing, generating, and signing.
              </p>
              <Link
                href="/billing"
                className="mt-3 flex h-8 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-[#141110] transition-colors hover:bg-white/90"
              >
                Top up
              </Link>
            </div>
          </div>
        )}
      </nav>
    </aside>
  )
}
