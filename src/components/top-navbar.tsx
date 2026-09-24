"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, ChevronUp, LogOut, Menu, Plus, Scale, Search } from "lucide-react"
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { ACCOUNT_NAV, PRIMARY_NAV, filterThreads, isActiveEntry, threadDate, type SidebarThread } from "@/lib/nav"

interface TopNavbarProps {
  email: string
  businessName?: string | null
  isLawyer?: boolean
  creditBalance?: number | null
  threads?: SidebarThread[]
  onHideTopbar?: () => void
}

/**
 * Slim app-wide top navbar: logo + thread search on the left; credit
 * balance (always visible, plain), notifications entry, and the single
 * account menu on the right. The sidebar carries no account row.
 */
export function TopNavbar({ email, businessName, isLawyer = false, creditBalance = null, threads = [], onHideTopbar }: TopNavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const displayName = businessName ?? email
  const initials = displayName.charAt(0).toUpperCase()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
        {/* Mobile web nav: top-anchored drawer, not a bottom app tab bar.
            The sidebar toggle below stays desktop-only. */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-4" aria-label="Site navigation">
            <div className="flex items-center px-2 pb-2 pt-1">
              <Logo />
            </div>
            <nav className="mt-2 flex flex-col gap-1" aria-label="Primary">
              {PRIMARY_NAV.map((item) => {
                const Icon = item.icon
                const isActive = isActiveEntry(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
                      isActive
                        ? "bg-burgundy/10 font-semibold text-burgundy"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
            <Link
              href="/audit/new"
              onClick={() => setMenuOpen(false)}
              className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-burgundy px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New deal
            </Link>
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" aria-label="Home" className="shrink-0">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search deals"
          className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden truncate lg:inline">Search deals</span>
          <kbd className="hidden shrink-0 rounded border border-border/60 bg-muted/60 px-1 text-[10px] font-medium sm:inline">⌘K</kbd>
        </button>
        <div className="min-w-0 flex-1" />
        <Link
          href="/billing"
          title="Credit balance — see Billing for what credits pay for"
          className="shrink-0 truncate text-sm tabular-nums text-muted-foreground transition-colors hover:text-foreground"
        >
          {typeof creditBalance === "number" ? `${creditBalance} credit${creditBalance === 1 ? "" : "s"}` : "credits unknown"}
        </Link>
        <Link
          href="/dashboard/activity"
          aria-label="Notifications"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account menu"
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center rounded-lg p-1 transition-colors hover:bg-muted/80"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[11px] font-medium">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>          <DropdownMenuContent className="w-52" align="end">
            <div className="max-w-full truncate px-2 py-1.5 text-xs text-muted-foreground">{displayName}</div>
            <DropdownMenuSeparator />
            {ACCOUNT_NAV.map((item) => {
              const Icon = item.icon
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className="w-full">
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              )
            })}
            {isLawyer && (
              <DropdownMenuItem asChild>
                <Link href="/lawyer" className="w-full">
                  <Scale className="mr-2 h-4 w-4" />
                  Lawyer workspace
                </Link>
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
        {onHideTopbar && (
          <button
            type="button"
            onClick={onHideTopbar}
            aria-label="Hide header"
            title="Hide header for more room"
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        )}
      </div>
      {searchOpen && <ThreadSearch threads={threads} onClose={() => setSearchOpen(false)} />}
    </header>
  )
}

function ThreadSearch({ threads, onClose }: { threads: SidebarThread[]; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const results = useMemo(() => filterThreads(threads, query), [threads, query])

  const go = (id: string) => {
    onClose()
    router.push(`/chat/${id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onClose()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, -1))
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      if (selectedIndex >= 0 && results[selectedIndex]) {
        go(results[selectedIndex].id)
      } else if (results.length > 0) {
        go(results[0].id)
      }
      return
    }
    // Reset selection when typing
    setSelectedIndex(-1)
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search deals">
      <button aria-label="Close search" className="absolute inset-0 cursor-default bg-black/40" onClick={onClose} />
      <div className="relative mx-auto mt-24 w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search deals…"
          aria-label="Search deals"
          aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
          aria-controls="search-results"
          aria-expanded={results.length > 0}
          className="w-full border-b border-border/60 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <div id="search-results" className="max-h-72 overflow-y-auto p-1.5" role="listbox">
          {results.length > 0 ? (
            results.map((t, i) => (
              <button
                key={t.id}
                id={`search-result-${i}`}
                onClick={() => go(t.id)}
                onMouseEnter={() => setSelectedIndex(i)}
                role="option"
                aria-selected={i === selectedIndex}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors ${
                  i === selectedIndex ? "bg-muted/80" : "hover:bg-muted/80"
                }`}
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
