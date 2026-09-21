"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Zap } from "lucide-react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import { PRIMARY_NAV, SECONDARY_NAV, isActiveEntry } from "@/lib/nav"

// Dark control sidebar: white pill for the active destination, lime count
// badges, lime top-up card when credits run low. Navigation carries live
// state; history lives in the main table, not here.
export function SidebarNav({ openIssues = 0, creditBalance = null }: { openIssues?: number; creditBalance?: number | null }) {
  const pathname = usePathname()
  const showTopUp = typeof creditBalance === "number" && creditBalance < 25

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-[#101216] text-white md:sticky md:top-0 md:h-auto md:max-h-none">
      <div className="flex items-center px-5 pt-6 text-white">
        <Logo />
      </div>
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
                    ? "bg-white font-semibold text-black"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {badge !== null && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D4F527] px-1.5 text-[10px] font-bold text-black" aria-label={`${badge} open issues`}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            )
          })}
          {SECONDARY_NAV.length > 0 && (
            <>
              <p className="px-4 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
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
                        ? "bg-white font-semibold text-black"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
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
            <div className="rounded-2xl bg-[#D4F527] p-4 text-black">
              <p className="flex items-center gap-1.5 text-[13px] font-bold">
                <Zap className="h-3.5 w-3.5" />
                Low credits
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-black/60">
                {creditBalance} left. Top up to keep analyzing, generating, and signing.
              </p>
              <Link
                href="/billing"
                className="mt-3 flex h-9 items-center justify-center rounded-full bg-black text-[12px] font-semibold text-white transition-colors hover:bg-black/80"
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
