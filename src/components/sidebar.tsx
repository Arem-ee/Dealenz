"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { PRIMARY_NAV } from "@/lib/nav"

// Standard enterprise sidebar: fixed flat list, icon plus label, active
// entry marked. Entries come from PRIMARY_NAV and grow tab by tab.
export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background md:flex" aria-label="Primary">
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-foreground font-semibold text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
