"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, LogOut, Menu, Plus, Scale, Search } from "lucide-react"
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
import { ACCOUNT_NAV, filterThreads, threadDate, type SidebarThread } from "@/lib/nav"

interface TopNavbarProps {
  email: string
  businessName?: string | null
  isLawyer?: boolean
  creditBalance?: number | null
  threads?: SidebarThread[]
  onHideTopbar?: () => void
}

/**
 * Fixed app-wide top navbar: logo on the left, search bar centered, credit
 * balance (always visible, plain), notifications entry, and the single
 * account menu on the right. Always pinned to the top — no hover reveal.
 * The sidebar carries no account row.
 */
export function TopNavbar({ email, businessName, isLawyer = false, creditBalance = null, threads = [] }: TopNavbarProps) {
  const router = useRouter()
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
    <header className="sticky top-0 z-40 h-12 shrink-0 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="flex h-full items-center gap-2 px-2 sm:px-3">
        {/* Left: mobile menu + logo */}
        <div className="flex min-w-0 shrink-0 items-center gap-1">
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
            {/* Slim-screen overflow: search and notifications collapse into
                the drawer on mobile; the topbar keeps menu, credits, avatar. */}
            <div className="mt-2 flex flex-col gap-1 md:hidden" aria-label="Quick actions">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  setSearchOpen(true)
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
              >
                <Search className="h-4 w-4" />
                <span>Search deals</span>
              </button>
              <Link
                href="/dashboard/activity"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
              </Link>
            </div>
            <Link
              href="/audit/new"
              onClick={() => setMenuOpen(false)}
              className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New deal
            </Link>
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" aria-label="Home" className="hidden shrink-0 min-[420px]:block">
          <Logo />
        </Link>
        </div>
        {/* Center: search bar, truly centered */}
        <div className="flex min-w-0 flex-1 items-center justify-center px-2">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search deals"
          className="flex h-9 w-full max-w-md items-center gap-2 rounded-full border border-border/60 bg-muted/60 px-3.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">Search...</span>
          <kbd className="hidden shrink-0 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
        </button>
        </div>
        {/* Right: credits, notifications, account */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <Link
          href="/billing"
          title="Credit balance — see Billing for what credits pay for"
          className="max-w-[110px] min-w-0 shrink truncate text-[13px] tabular-nums text-muted-foreground transition-colors hover:text-foreground sm:max-w-none"
        >
          {typeof creditBalance === "number" ? `${creditBalance} credit${creditBalance === 1 ? "" : "s"}` : "credits unknown"}
        </Link>
        <Link
          href="/dashboard/activity"
          aria-label="Notifications"
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground md:flex"
        >
          <Bell className="h-3.5 w-3.5" />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account menu"
              className="flex h-8 w-8 shrink-0 items-center rounded-lg p-1 transition-colors hover:bg-muted/80"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] font-medium">{initials}</AvatarFallback>
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
        </div>
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
          role="combobox"
          aria-autocomplete="list"
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
