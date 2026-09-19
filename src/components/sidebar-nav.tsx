"use client"

import { useRouter, usePathname } from "next/navigation"
import { LogOut, Scale, MessageCircle } from "lucide-react"
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
  threads?: SidebarThread[]
}

export interface SidebarThread {
  id: string
  title: string
  updatedAt: string
}

function threadDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function SidebarNav({ email, businessName, isLawyer = false, creditBalance = null, threads = [] }: SidebarNavProps) {
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
        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          <p className="shrink-0 px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Threads
          </p>
          {threads.length > 0 ? (
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5" aria-label="Threads">
              {threads.map((t) => {
                const href = `/chat/${t.id}`
                const isActive = pathname === href
                return (
                  <Link
                    key={t.id}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    title={t.title}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    )}
                  >
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{t.title || "Untitled"}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground/60">{threadDate(t.updatedAt)}</span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="px-3 py-1 text-xs text-muted-foreground/60">
              No threads yet — start from Home.
            </p>
          )}
        </div>
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
