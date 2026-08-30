"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, User, Plus, MoreHorizontal, LogOut, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconDeal, IconClient, IconRiskFlag, IconTemplate } from "@/components/icons"
import { createClient } from "@/lib/supabase/client"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

const items = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Deals", href: "/deals", icon: IconDeal },
  { label: null, href: "/audit/new", icon: Plus, fab: true },
  { label: "Clients", href: "/clients", icon: IconClient },
  { label: "More", href: null, icon: MoreHorizontal, sheet: true },
]

const moreItems = [
  { label: "Risk Intelligence", href: "/risk-intelligence", icon: IconRiskFlag },
  { label: "Templates", href: "/templates", icon: IconTemplate },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/dashboard/settings", icon: User },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setMoreOpen(false)
    router.push("/login")
    router.refresh()
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background md:hidden">
      <div className="flex items-center justify-around h-14 px-2">
        {items.map((item) => {
          const Icon = item.icon

          if (item.fab) {
            return (
              <Link
                key="fab"
                href={item.href}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg -mt-5 hover:bg-primary/90 transition-colors"
              >
                <Icon className="h-5 w-5" />
              </Link>
            )
          }

          if (item.sheet) {
            return (
              <Sheet key="more" open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetTrigger asChild>
                  <button
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors",
                      moreOpen ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="p-4 pb-8">
                  <div className="flex flex-col gap-1">
                    {moreItems.map((mi) => {
                      const Mi = mi.icon
                      const isActive = pathname === mi.href || pathname.startsWith(mi.href + "/")
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
                    <div className="border-t border-border/60 my-1" />
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors w-full text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
            )
          }

          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.label}
              href={item.href!}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label && <span>{item.label}</span>}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
