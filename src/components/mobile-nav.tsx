"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus, MoreHorizontal, Scale } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { PRIMARY_NAV, SECONDARY_NAV, isActiveEntry } from "@/lib/nav"

/** Bottom bar renders the deal control room IA: Deals, Guarded, create (new chat), More. */
const BAR_TABS = [PRIMARY_NAV[0], PRIMARY_NAV[1]]

/** Overflow sheet: everything else, deduplicated by destination. Account
 *  items live solely in the top navbar's account menu — never here. */
const MORE_ITEMS = [...PRIMARY_NAV.slice(2), ...SECONDARY_NAV].filter(
  (item, index, arr) => arr.findIndex((other) => other.href === item.href) === index
)

export function MobileNav({ isLawyer = false }: { isLawyer?: boolean }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const showMore = isLawyer || MORE_ITEMS.length > 0

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background md:hidden" aria-label="Primary">
      <div className="flex items-center justify-around h-14 px-2">
        {BAR_TABS.map((item) => {
          const Icon = item.icon
          const isActive = isActiveEntry(pathname, item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
        <Link
          href="/chat"
          aria-label="New chat"
          className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-raised -mt-5 hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-5 w-5" />
        </Link>
        {showMore && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors",
                moreOpen ? "text-primary" : "text-muted-foreground"
              )}
              aria-expanded={moreOpen}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="p-4 pb-8">
            <div className="flex flex-col gap-1">
              {isLawyer && (
                <Link
                  href="/lawyer"
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    pathname.startsWith("/lawyer")
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  )}
                >
                  <Scale className="h-4 w-4" />
                  <span>Lawyer workspace</span>
                </Link>
              )}
              {MORE_ITEMS.map((mi) => {
                const Mi = mi.icon
                const isActive = isActiveEntry(pathname, mi.href)
                return (
                  <Link
                    key={mi.href}
                    href={mi.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    )}
                  >
                    <Mi className="h-4 w-4" />
                    <span>{mi.label}</span>
                  </Link>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
        )}
      </div>
    </nav>
  )
}
