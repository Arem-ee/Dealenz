"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { LOW_CREDIT_THRESHOLD } from "@/lib/credits/pricing"
import { PRIMARY_NAV, SECONDARY_NAV, isActiveEntry, type SidebarThread } from "@/lib/nav"

// Hover-expand brand sidebar: a slim icon rail at rest that widens on hover,
// no manual collapse button — the standard auto-rail pattern. Labels and the
// recent list fade in only when expanded; the collapsed rail keeps icons
// (and the open-issue badge) glanceable. Desktop only; mobile navigates from
// the top navbar drawer.
export function SidebarNav({ openIssues = 0, creditBalance = null, threads = [], flushTop = false }: {
  openIssues?: number
  creditBalance?: number | null
  threads?: SidebarThread[]
  flushTop?: boolean
}) {
  const pathname = usePathname()
  const showTopUp = typeof creditBalance === "number" && creditBalance < LOW_CREDIT_THRESHOLD
  const recent = [...(threads ?? [])].slice(0, 5)

  return (
    <aside className={`group/nav hidden md:flex md:flex-col shrink-0 border-r border-border/60 bg-background w-16 hover:w-60 transition-[width] duration-200 overflow-hidden ${flushTop ? "md:top-0 md:h-[100dvh]" : "md:top-14 md:h-[calc(100dvh-3.5rem)]"} md:sticky`}>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-2.5" aria-label="Primary">
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
                title={item.label}
                className={cn(
                  "flex items-center gap-2.5 rounded-full px-4 py-2 text-[13px] transition-colors",
                  isActive
                    ? "bg-burgundy/10 font-semibold text-burgundy"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                <span className="relative shrink-0">
                  <Icon className="h-4 w-4" />
                  {badge !== null && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-burgundy px-0.5 text-[9px] font-bold text-white group-hover/nav:hidden" aria-label={`${badge} open issues`}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className="flex-1 whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100">{item.label}</span>
                {badge !== null && (
                  <span className="hidden h-5 min-w-5 items-center justify-center rounded-full bg-burgundy px-1.5 text-[10px] font-bold text-white group-hover/nav:flex" aria-hidden>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            )
          })}
          {SECONDARY_NAV.length > 0 && (
            <>
              <p className="whitespace-nowrap px-4 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70 opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100">
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
                    title={item.label}
                    className={cn(
                      "flex items-center gap-2.5 rounded-full px-4 py-2 text-[13px] transition-colors",
                      isActive
                        ? "bg-burgundy/10 font-semibold text-burgundy"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100">{item.label}</span>
                  </Link>
                )
              })}
            </>
          )}
        </div>
        {recent.length > 0 && (
          <div className="mt-4 hidden min-h-0 flex-1 flex-col group-hover/nav:flex">
            <p className="shrink-0 whitespace-nowrap px-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Recent
            </p>
            <ul className="min-h-0 space-y-0.5 overflow-y-auto">
              {recent.map((t) => {
                const isActive = pathname === `/chat/${t.id}`
                const needsAttention = typeof t.riskLevel === "string" && /high|critical/i.test(t.riskLevel)
                return (
                  <li key={t.id}>
                    <Link
                      href={`/chat/${t.id}`}
                      aria-current={isActive ? "page" : undefined}
                      title={t.title || "Untitled"}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-4 py-1.5 text-[13px] transition-colors",
                        isActive
                          ? "bg-burgundy/10 font-semibold text-burgundy"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      )}
                    >
                      {needsAttention && (
                        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-burgundy" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{t.title || "Untitled"}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {showTopUp && (
          <div className="mt-auto hidden shrink-0 px-1 pb-1 pt-4 group-hover/nav:block">
            <div className="whitespace-nowrap rounded-2xl bg-burgundy p-4 text-white">
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
