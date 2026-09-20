"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import { PRIMARY_NAV, SECONDARY_NAV, isActiveEntry } from "@/lib/nav"

/**
 * Minimal desktop sidebar: logo plus Home/Library only. Account, credits,
 * and notifications live in the top navbar; threads live on Home (recent
 * activity) and in navbar search.
 */
export function SidebarNav() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex md:flex-col w-56 border-r border-border/60 bg-background shrink-0 md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)]">
      <div className="flex h-14 items-center px-5 border-b border-border/60" aria-hidden="true">
        <Logo />
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 p-3 mt-1 min-h-0" aria-label="Primary">
        <div className="shrink-0 space-y-0.5">
          {PRIMARY_NAV.map((item) => {
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
      </nav>
    </aside>
  )
}
