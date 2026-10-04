"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, CalendarClock, CheckCircle2, Info, PenLine, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getNotifications,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/notifications/actions"
import { timeAgo, type NotificationRow } from "@/lib/notifications/store"

const TYPE_META: Record<NotificationRow["type"], { label: string; Icon: typeof Bell }> = {
  reminder: { label: "Reminder", Icon: CalendarClock },
  success: { label: "Success", Icon: CheckCircle2 },
  approval: { label: "Approval", Icon: ShieldCheck },
  status: { label: "Status", Icon: Info },
  signing: { label: "Signing", Icon: PenLine },
}

// Notification bell: unread badge plus an inline panel (same pattern as
// the account menu — anchored dropdown, outside-click and Escape close,
// never a modal). Re-reads on every open so the count never goes stale.
export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[] | null>(null)
  const [unread, setUnread] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await getNotifications(30)
      if (!res.ok) return
      setItems(res.items)
      setUnread(res.unread)
    } catch {
      // Bell stays quiet on failure; toasts own error surfacing.
    }
  }, [])

  useEffect(() => {
    let live = true
    getNotifications(30)
      .then((res) => {
        if (!live || !res.ok) return
        setItems(res.items)
        setUnread(res.unread)
      })
      .catch(() => {
        // Bell stays quiet on failure; toasts own error surfacing.
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) void load()
  }

  async function openItem(item: NotificationRow) {
    if (!item.read_at) {
      try {
        await markNotificationReadAction(item.id)
      } catch {
        // Navigation proceeds regardless.
      }
      setItems((prev) => prev?.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)) ?? null)
      setUnread((u) => Math.max(0, u - 1))
    }
    setOpen(false)
    if (item.link) router.push(item.link)
  }

  async function markAll() {
    try {
      const res = await markAllNotificationsReadAction()
      if (!res.ok) return
      setItems((prev) => prev?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null)
      setUnread(0)
    } catch {
      // Silent; the panel still shows the items.
    }
  }

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={toggle}
        className="relative flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center bg-destructive px-1 text-[10px] font-bold tabular-nums text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 flex max-h-[70vh] w-80 flex-col border border-border bg-background" aria-label="Notifications">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3.5 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAll()}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {(items ?? []).map((item) => {
              const meta = TYPE_META[item.type] ?? TYPE_META.status
              const Icon = meta.Icon
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className="flex w-full gap-2.5 border-b border-border px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-muted"
                  >
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", item.read_at ? "text-muted-foreground" : "text-foreground")} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs">
                        <span className={cn("font-semibold", item.read_at ? "text-muted-foreground" : "text-foreground")}>{meta.label}</span>
                        {" · "}
                        <span className={item.read_at ? "font-normal text-muted-foreground" : "font-medium text-foreground"}>{item.title}</span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{item.body}</span>
                      <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground/70">{timeAgo(item.created_at)}</span>
                    </span>
                    {!item.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-foreground" aria-label="Unread" />}
                  </button>
                </li>
              )
            })}
            {items !== null && items.length === 0 && (
              <li className="px-3.5 py-8 text-center">
                <Bell className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">All caught up</p>
                <p className="mt-1 text-xs text-muted-foreground">Signatures, expiries, and approvals land here.</p>
              </li>
            )}
            {items === null && (
              <li className="px-3.5 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            )}
          </ul>
          <div className="shrink-0 border-t border-border px-3.5 py-2">
            <Link href="/tracker" onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground hover:text-foreground">
              Review everything in Tracker
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
