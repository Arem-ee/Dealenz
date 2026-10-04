"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, Menu, Plus, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Logo } from "@/components/logo"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { PRIMARY_NAV, filterThreads, threadDate, type SidebarThread } from "@/lib/nav"

// Orthogonal top bar: logo left, inline search center, credits and account
// right. Pinned to the top. No popups — search results and the account
// panel render inline beneath the bar.
export function TopBar({ email, businessName, creditBalance = null, threads = [] }: {
  email: string
  businessName?: string | null
  creditBalance?: number | null
  threads?: SidebarThread[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const displayName = businessName ?? email
  const initials = displayName.charAt(0).toUpperCase()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (accountWrapRef.current && !accountWrapRef.current.contains(e.target as Node)) setAccountOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 h-12 shrink-0 border-b border-border bg-background">
      <div className="flex h-full items-center gap-2 px-2 sm:px-3">
        <div className="flex min-w-0 shrink-0 items-center gap-1">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open navigation menu"
                aria-expanded={menuOpen}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-4" aria-label="Site navigation">
              <div className="flex items-center px-2 pb-2 pt-1">
                <Logo />
              </div>
              <nav className="mt-2 flex flex-col gap-0.5" aria-label="Primary">
                {PRIMARY_NAV.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
              <Link
                href="/chat/new"
                onClick={() => setMenuOpen(false)}
                className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
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
        <div className="flex min-w-0 flex-1 items-center justify-center px-2">
          <InlineSearch threads={threads} />
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <NotificationBell />
          <span
            title="Credit balance"
            className="max-w-[110px] min-w-0 shrink truncate text-[13px] tabular-nums text-muted-foreground sm:max-w-none"
          >
            {typeof creditBalance === "number" ? `${creditBalance} credit${creditBalance === 1 ? "" : "s"}` : ""}
          </span>
          <div className="relative shrink-0" ref={accountWrapRef}>
            <button
              aria-label="Account menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((v) => !v)}
              className="flex h-8 w-8 items-center p-1 transition-colors hover:bg-muted"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] font-medium">{initials}</AvatarFallback>
              </Avatar>
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-52 border border-border bg-background" aria-label="Account menu">
                <div className="max-w-full truncate px-3 py-2 text-xs text-muted-foreground">{displayName}</div>
                <div className="border-t border-border" />
                <button onClick={() => void handleSignOut()} className="flex w-full items-center px-3 py-2.5 text-sm transition-colors hover:bg-muted">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function InlineSearch({ threads }: { threads: SidebarThread[] }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const results = useMemo(() => filterThreads(threads, query), [threads, query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [])

  const go = (id: string) => {
    setQuery("")
    setOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.blur()
    router.push(`/chat/${id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
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
    setSelectedIndex(-1)
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <div className="flex h-9 w-full items-center gap-2 border border-border bg-muted px-3.5 text-[13px] text-muted-foreground transition-colors focus-within:border-foreground focus-within:bg-background focus-within:text-foreground">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input
          ref={inputRef}
          id="topbar-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setSelectedIndex(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          aria-label="Search deals"
          role="combobox"
          aria-autocomplete="list"
          aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
          aria-controls="topbar-search-results"
          aria-expanded={open}
          autoComplete="off"
          className="min-w-0 flex-1 truncate bg-transparent text-left outline-none placeholder:text-muted-foreground"
        />
        {query === "" && (
          <kbd className="hidden shrink-0 border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
        )}
      </div>
      {open && (
        <div id="topbar-search-results" className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto border border-border bg-background p-1.5" role="listbox" aria-label="Search deals">
          {results.length > 0 ? (
            results.map((t, i) => (
              <button
                key={t.id}
                id={`search-result-${i}`}
                onClick={() => go(t.id)}
                onMouseEnter={() => setSelectedIndex(i)}
                role="option"
                aria-selected={i === selectedIndex}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                  i === selectedIndex ? "bg-muted" : "hover:bg-muted"
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{t.title || "Untitled"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{threadDate(t.updatedAt)}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {threads.length === 0 ? "No deals yet — start from Home." : "No matching deals."}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
