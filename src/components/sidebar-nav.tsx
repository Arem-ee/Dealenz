"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PRIMARY_NAV, SECONDARY_NAV, isActiveEntry, threadDate, type SidebarThread } from "@/lib/nav"

/**
 * Minimal desktop sidebar: Home/Library, then recent deals. Account,
 * credits, and notifications live in the top navbar. Deal rows carry a
 * risk dot when the attached audit has a headline rating, else a neutral
 * dot — presence of color always means measured risk, never decoration.
 */
export function SidebarNav({ threads = [] }: { threads?: SidebarThread[] }) {
  const pathname = usePathname()
  const recent = threads.slice(0, 12)

  return (
    <aside className="hidden md:flex md:flex-col w-56 border-r border-border/60 bg-background shrink-0 md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)]">
      <nav className="flex-1 flex flex-col gap-0.5 p-3 min-h-0 overflow-y-auto" aria-label="Primary">
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
        {recent.length > 0 && (
          <div className="mt-4 min-h-0">
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Recent deals
            </p>
            <ul aria-label="Recent deals" className="space-y-px">
              {recent.map((t) => {
                const href = `/chat/${t.id}`
                const isActive = pathname === href
                const dot = riskDot(t.riskLevel)
                return (
                  <li key={t.id}>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot ?? "bg-border")}
                        title={t.riskLevel ?? undefined}
                      />
                      <span className="min-w-0 flex-1 truncate">{t.title || "Untitled"}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground/70">{threadDate(t.updatedAt)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </nav>
    </aside>
  )
}

function riskDot(level: string | null | undefined): string | null {
  if (!level) return null
  const l = level.toLowerCase()
  if (l === "high" || l === "critical") return "bg-red-500"
  if (l === "medium" || l === "material") return "bg-amber-500"
  if (l === "low") return "bg-emerald-500"
  return null
}
