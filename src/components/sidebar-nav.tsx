"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeftClose, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { PRIMARY_NAV, SECONDARY_NAV, isActiveEntry } from "@/lib/nav"

// Brand sidebar: light surface, burgundy marks the active destination,
// the open-issue count, and the low-credit top-up. Navigation carries
// live state; history lives in the main table, not here.
export function SidebarNav({ openIssues = 0, creditBalance = null, onCollapse, flushTop = false }: { openIssues?: number; creditBalance?: number | null; onCollapse?: () => void; flushTop?: boolean }) {
  const pathname = usePathname()
  const showTopUp = typeof creditBalance === "number" && creditBalance < 25

  return (
    <aside className={`hidden md:flex md:flex-col w-60 shrink-0 border-r border-border/60 bg-background md:sticky ${flushTop ? "md:top-0 md:h-[100dvh]" : "md:top-14 md:h-[calc(100dvh-3.5rem)]"}`}>
      {onCollapse && (
        <div className="flex justify-end px-3 pt-2">
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar for more room"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      )}
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
                  "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-burgundy/10 font-semibold text-burgundy"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {badge !== null && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-burgundy px-1.5 text-[10px] font-bold text-white" aria-label={`${badge} open issues`}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            )
          })}
          {SECONDARY_NAV.length > 0 && (
            <>
              <p className="px-4 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
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
                      "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors",
                      isActive
                        ? "bg-burgundy/10 font-semibold text-burgundy"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
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
            <div className="rounded-2xl bg-burgundy p-4 text-white">
              <p className="flex items-center gap-1.5 text-[13px] font-bold">
                <Zap className="h-3.5 w-3.5" />
                Low credits
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/70">
                {creditBalance} left. Top up to keep analyzing, generating, and signing.
              </p>
              <Link
                href="/billing"
                className="mt-3 flex h-9 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-burgundy transition-colors hover:bg-white/90"
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
