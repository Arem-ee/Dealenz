"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { PRIMARY_NAV } from "@/lib/nav"

// Fixed icon rail: icons always visible, expands to full labels on hover.
// Entries come from PRIMARY_NAV and grow tab by tab.
export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside
      className="group/nav hidden w-12 shrink-0 flex-col overflow-hidden border-r border-border bg-background transition-[width] duration-200 hover:w-60 md:flex"
      aria-label="Primary"
    >
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-1.5">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              title={item.label}
              className={cn(
                "flex items-stretch gap-0 text-[13px] transition-colors",
                isActive
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span
                aria-hidden
                className={cn("w-0.5 shrink-0 self-stretch", isActive ? "bg-foreground" : "bg-transparent")}
              />
              <span className="flex min-w-0 items-center gap-2 px-2.5 py-2">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100">
                  {item.label}
                </span>
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
