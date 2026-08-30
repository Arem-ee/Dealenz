"use client"

import { useState, useEffect, useRef } from "react"
import type { ComponentType } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Bell, Plus, Search, X, Command } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { IconDeal } from "@/components/icons"
import { searchDeals, getRecentNotifications } from "@/app/dashboard/actions"

interface SearchResult {
  id: string
  name: string
  href: string
  icon: ComponentType<{ className?: string }>
}

interface NotificationItem {
  id: string
  type: string
  text: string
  dealId: string | null
  read: boolean
}

const activityLabels: Record<string, string> = {
  analysis_completed: "Risk analysis completed",
  analysis_failed: "Risk analysis failed",
  analysis_started: "Risk analysis started",
  checklist_item_updated: "Checklist item updated",
  document_reviewed: "Document reviewed",
  document_viewed: "Document viewed",
  documents_generated: "Protection package generated",
  file_attached: "File attached",
  status_changed: "Status changed",
  title_changed: "Title changed",
}

export function TopNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [notifOpen, setNotifOpen] = useState(false)
  const [allResults, setAllResults] = useState<SearchResult[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === "Escape") {
        setSearchOpen(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [searchOpen])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchOpen(false)
  }, [pathname])

  const pageTitle =
    pathname === "/dashboard" ? "Home" :
    pathname.startsWith("/dashboard") ? "Home" :
    pathname.startsWith("/audit") ? "Deal Workspace" :
    pathname.startsWith("/deals") ? "Deals" :
    pathname.startsWith("/clients") ? "Clients" :
    pathname.startsWith("/risk-intelligence") ? "Risk Intelligence" :
    pathname.startsWith("/templates") ? "Templates" :
    "Dealenz"

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setAllResults([]) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }

    const timer = setTimeout(async () => {
      const res = await searchDeals(trimmed)
      if (!res.success || !res.results) {
        setAllResults([])
        return
      }
      setAllResults(res.results.map((audit: { id: string; title: string }) => ({
        id: audit.id,
        name: audit.title,
        href: `/audit/${audit.id}`,
        icon: IconDeal,
      })))
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    getRecentNotifications().then((res) => {
      if (!res.success || !res.events) return
      setNotifications(res.events.map((event: { id: string; event_type: string; audit_id: string | null; payload: Record<string, unknown>; created_at: string }) => {
        const payload = event.payload ?? {}
        const documentType = typeof payload.documentType === "string"
          ? ` (${payload.documentType})`
          : ""
        return {
          id: event.id,
          type: event.event_type,
          text: `${activityLabels[event.event_type] ?? event.event_type}${documentType}`,
          dealId: event.audit_id as string | null,
          read: false,
        }
      }))
    })
  }, [])

  return (
    <>
      <header className="flex h-12 items-center gap-3 px-4 border-b border-border/60 bg-background glass-strong">
        <span className="text-sm font-medium text-muted-foreground md:hidden">dealenz</span>
        <span className="hidden md:block text-sm font-medium">{pageTitle}</span>

        <button
          onClick={() => setSearchOpen(true)}
          className="hidden sm:flex flex-1 max-w-xs ml-4 items-center gap-2 h-8 rounded-md border border-input bg-muted/50 px-3 text-xs text-muted-foreground hover:border-muted-foreground/30 transition-colors"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Search deals, clients...</span>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/60">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        <div className="flex items-center gap-1 ml-auto">
          <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
            <SheetTrigger asChild>
              <button className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <h2 className="sr-only">Notifications</h2>
              <div className="flex items-center justify-between px-4 h-12 border-b border-border/60">
                <span className="text-sm font-medium">Notifications</span>
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Mark all read
                </button>
              </div>
              <div className="divide-y divide-border/60">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
                    <Bell className="h-5 w-5 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setNotifOpen(false)
                        if (n.dealId) router.push(`/audit/${n.dealId}`)
                      }}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                        !n.read && "bg-primary/[0.02]"
                      )}
                    >
                      <div className={cn(
                        "mt-1 h-2 w-2 rounded-full shrink-0",
                        n.type === "risk" ? "bg-risk-high" : "bg-risk-medium"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs", !n.read ? "font-medium text-foreground" : "text-muted-foreground")}>
                          {n.text}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Link
            href="/audit/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Deal</span>
          </Link>
        </div>
      </header>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-lg glass-elevated rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 h-12 border-b border-border/60">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search deals, clients, templates..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
              <kbd className="text-[10px] text-muted-foreground/50 border border-border/60 rounded px-1.5 py-0.5">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {query.trim() && allResults.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Search className="h-5 w-5 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
                </div>
              ) : query.trim() ? (
                <div className="space-y-0.5">
                  {allResults.map((item, i) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={i}
                        href={item.href}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted/80 transition-colors"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-3 px-3 py-3 text-xs text-muted-foreground">
                  <Command className="h-3 w-3" />
                  <span>Type to search or use <kbd className="border border-border/60 rounded px-1">⌘K</kbd> anytime</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
