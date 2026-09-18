"use client"

import { useRouter, usePathname } from "next/navigation"
import { LogOut, Scale } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Logo } from "@/components/logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PRIMARY_NAV, SECONDARY_NAV, ACCOUNT_NAV, isActiveEntry } from "@/lib/nav"

interface SidebarNavProps {
  email: string
  businessName?: string | null
  isLawyer?: boolean
  creditBalance?: number | null
}

export function SidebarNav({ email, businessName, isLawyer = false, creditBalance = null }: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const displayName = businessName ?? email
  const initials = displayName.charAt(0).toUpperCase()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="hidden md:flex md:flex-col w-56 border-r border-border/60 bg-background shrink-0">
      <div className="flex h-14 items-center px-5 border-b border-border/60">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 p-3 mt-1" aria-label="Primary">
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
      </nav>

      <div className="p-3 border-t border-border/60">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] font-medium">{initials}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-xs">{displayName}</span>
                <span className="block text-[10px] text-muted-foreground/70">
                  {typeof creditBalance === "number" ? `${creditBalance} credits` : email}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="start" side="right">
            {ACCOUNT_NAV.map((item) => {
              const Icon = item.icon
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <button className="w-full" onClick={() => router.push(item.href)}>
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </button>
                </DropdownMenuItem>
              )
            })}
            {isLawyer && (
              <DropdownMenuItem asChild>
                <button className="w-full" onClick={() => router.push("/lawyer")}>
                  <Scale className="mr-2 h-4 w-4" />
                  Lawyer workspace
                </button>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <button className="w-full" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
