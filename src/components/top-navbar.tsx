"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, LogOut, Scale, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Logo } from "@/components/logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ACCOUNT_NAV, filterThreads, threadDate, type SidebarThread } from "@/lib/nav"

interface TopNavbarProps {
  email: string
  businessName?: string | null
  isLawyer?: boolean
  creditBalance?: number | null
  threads?: SidebarThread[]
}

/**
 * Slim app-wide top navbar: logo + thread search on the left; credit
 * balance (always visible, plain), notifications entry, and the single
 * account menu on the right. The sidebar carries no account row.
 */
export function TopNavbar({ email, businessName, isLawyer = false, creditBalance = null, threads = [] }: TopNavbarProps) {
  const router = useRouter()
  const supabase = createClient()
  const displayName = businessName ?? email
  const initials = displayName.charAt(0).toUpperCase()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 h-14 shrink-0 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="flex h-full items-center gap-1.5 px-3 sm:gap-2 sm:px-4">
        <Link href="/dashboard" aria-label="Home" className="shrink-0">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search threads"
          className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden truncate lg:inline">Search threads</span>
          <kbd className="hidden shrink-0 rounded border border-border/60 bg-muted/60 px-1 text-[10px] font-medium sm:inline">⌘K</kbd>
        </button>
        <div className="min-w-0 flex-1" />
        <span
          title="Credit balance"
          className="shrink-0 text-sm tabular-nums text-muted-foreground"
        >
          {typeof creditBalance === "number" ? `${creditBalance} credits` : "—"}
        </span>
        <Link
          href="/dashboard/activity"
          aria-label="Notifications"
          className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account menu"
              className="flex shrink-0 items-center rounded-lg p-1 transition-colors hover:bg-muted/80"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[11px] font-medium">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52" align="end">
            <div className="max-w-full truncate px-2 py-1.5 text-xs text-muted-foreground">{displayName}</div>
            <DropdownMenuSeparator />
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
      {searchOpen && <ThreadSearch threads={threads} onClose={() => setSearchOpen(false)} />}
    </header>
  )
}

function ThreadSearch({ threads, onClose }: { threads: SidebarThread[]; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const results = useMemo(() => filterThreads(threads, query), [threads, query])

  const go = (id: string) => {
    onClose()
    router.push(`/chat/${id}`)
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search threads">
      <button aria-label="Close search" className="absolute inset-0 cursor-default bg-black/40" onClick={onClose} />
      <div className="relative mx-auto mt-24 w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose()
            if (e.key === "Enter" && results.length > 0) go(results[0].id)
          }}
          placeholder="Search threads…"
          aria-label="Search threads"
          className="w-full border-b border-border/60 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <div className="max-h-72 overflow-y-auto p-1.5">
          {results.length > 0 ? (
            results.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/80"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{t.title || "Untitled"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{threadDate(t.updatedAt)}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {threads.length === 0 ? "No threads yet — start from Home." : "No matching threads."}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
