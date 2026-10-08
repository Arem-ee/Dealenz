"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, Menu, Plus, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/toast"
import { Logo } from "@/components/logo"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { PRIMARY_NAV, filterThreads, threadDate, type SidebarThread } from "@/lib/nav"

// Orthogonal top bar: logo left, inline search center, credits and account
// right. Pinned to the top. No popups — search results and the account
// panel render inline beneath the bar.
export function TopBar({ email, businessName, creditBalance = null, threads = [], scopeOrgId = null, scopeOrgs = [], scopeLabel = null }: {
  email: string
  businessName?: string | null
  creditBalance?: number | null
  threads?: SidebarThread[]
  scopeOrgId?: string | null
  scopeOrgs?: Array<{ orgId: string; orgName: string; balance: number | null }>
  scopeLabel?: string | null
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
          {scopeOrgs.length > 0 && (
            <ScopeSwitcher scopeOrgId={scopeOrgId} scopeOrgs={scopeOrgs} />
          )}
          <span
            title={scopeLabel ? `Pool balance · ${scopeLabel}` : "Credit balance"}
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

// Billing scope switch: solo balance or one org pool. The switch is
// explicit and sticky (user_billing_scope); spend policy reads it per
// operation and the RPCs enforce membership per call.
function ScopeSwitcher({ scopeOrgId, scopeOrgs }: {
  scopeOrgId: string | null
  scopeOrgs: Array<{ orgId: string; orgName: string; balance: number | null }>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function switchScope(orgId: string | null) {
    if (busy || orgId === scopeOrgId) return
    setBusy(true)
    try {
      const { setSpendScopeAction } = await import("@/lib/billing/subscription-actions")
      const res = await setSpendScopeAction(orgId)
      if (!res.ok) throw new Error(res.error)
      router.refresh()
    } catch {
      // Silent; the controlled value snaps back on the next refresh.
    } finally {
      setBusy(false)
    }
  }

  return (
    <select
      value={scopeOrgId ?? ""}
      onChange={(e) => void switchScope(e.target.value === "" ? null : e.target.value)}
      disabled={busy}
      aria-label="Billing scope"
      title="Spend from solo balance or a pool"
      className="h-8 max-w-[110px] shrink-0 truncate border border-transparent bg-transparent px-1 text-[12px] text-muted-foreground outline-none transition-colors hover:border-border hover:text-foreground disabled:opacity-50 sm:max-w-[150px]"
    >
      <option value="">Solo</option>
      {scopeOrgs.map((o) => (
        <option key={o.orgId} value={o.orgId}>
          {o.orgName}{typeof o.balance === "number" ? ` · ${o.balance}` : ""}
        </option>
      ))}
    </select>
  )
}

const SEARCH_TYPES = ["founder", "partnership", "purchase_sale", "lease", "employment", "freelance"] as const

interface SearchItem {
  key: string
  title: string
  sub: string | null
  snippet: string | null
  threadId: string | null
}

/**
 * ts_headline marks matches with <b> tags but passes document text through
 * unescaped — a stored document containing markup would inject HTML.
 * Snippets render as text only; highlighting is dropped for safety.
 */
function stripSnippetTags(snippet: string): string {
  return snippet.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

function InlineSearch({ threads }: { threads: SidebarThread[] }) {
  const { showError } = useToast()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [hits, setHits] = useState<SearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const threadResults = useMemo(() => filterThreads(threads, query), [threads, query])

  // Exhaustive content search (deals + versions + clauses) alongside the
  // thread filter. Debounced, RLS-scoped server-side; threads stay instant
  // and client-side. Content rows without a resolvable thread are dropped —
  // every result must land somewhere.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    let live = true
    const timer = setTimeout(() => {
      if (!live) return
      setSearching(true)
      import("@/app/(app)/search/actions")
        .then((m) =>
          m.searchContent({ query: q, dealTypes: typeFilter ? [typeFilter] : [] })
        )
        .then((res) => {
          if (!live) return
          setSearching(false)
          if (!res.ok) {
            showError(res.error)
            setHits([])
            return
          }
          const seen = new Set(threadResults.map((t) => t.id))
          setHits(
            res.hits
              .filter((h) => h.threadId && !seen.has(h.threadId))
              .slice(0, 8)
              .map((h) => ({
                key: `hit:${h.dealId}:${h.kind}`,
                title: h.title,
                sub: h.kind === "clause" ? `Clause match · ${h.dealType?.replace("_", " ") ?? "deal"}` : h.dealType?.replace("_", " ") ?? null,
                snippet: h.snippet,
                threadId: h.threadId,
              }))
          )
        })
        .catch(() => {
          if (!live) return
          setSearching(false)
          setHits([])
        })
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query, typeFilter, showError, threadResults])

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

  const items: SearchItem[] = useMemo(
    () => [
      ...threadResults.map((t) => ({
        key: `thread:${t.id}`,
        title: t.title || "Untitled",
        sub: null as string | null,
        snippet: null as string | null,
        threadId: t.id as string | null,
      })),
      ...hits,
    ],
    [threadResults, hits]
  )

  const go = (threadId: string | null) => {
    if (!threadId) return
    setQuery("")
    setOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.blur()
    router.push(`/chat/${threadId}`)
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
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, -1))
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      if (selectedIndex >= 0 && items[selectedIndex]) {
        go(items[selectedIndex].threadId)
      } else if (items.length > 0) {
        go(items[0].threadId)
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
            const next = e.target.value
            setQuery(next)
            setOpen(true)
            setSelectedIndex(-1)
            if (next.trim().length < 2) {
              setHits([])
              setSearching(false)
            }
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
        <div id="topbar-search-results" className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto border border-border bg-background p-1.5" role="listbox" aria-label="Search deals">
          {query.trim().length >= 2 ? (
            <div className="flex flex-wrap gap-1 px-1.5 pb-1.5" aria-label="Filter by deal type">
              {SEARCH_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={typeFilter === t}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setTypeFilter((prev) => (prev === t ? null : t))}
                  className={`border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    typeFilter === t
                      ? "border-foreground bg-muted text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.replace("_", " ")}
                </button>
              ))}
            </div>
          ) : null}
          {items.length > 0 ? (
            items.map(({ key, title, sub, snippet, threadId }, i) => (
              <button
                key={key}
                id={`search-result-${i}`}
                onClick={() => {
                  if (!threadId) return
                  setQuery("")
                  setOpen(false)
                  setSelectedIndex(-1)
                  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
                  router.push(`/chat/${threadId}`)
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                role="option"
                aria-selected={i === selectedIndex}
                className={`block w-full px-3 py-2.5 text-left text-sm transition-colors ${
                  i === selectedIndex ? "bg-muted" : "hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
                  {sub ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{sub}</span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {threadDate(threadResults.find((t) => t.id === threadId)?.updatedAt ?? "")}
                    </span>
                  )}
                </span>
                {snippet ? (
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                    {stripSnippetTags(snippet)}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {searching
                ? "Searching documents…"
                : threads.length === 0
                  ? "No deals yet — start from Home."
                  : "No matching deals."}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
