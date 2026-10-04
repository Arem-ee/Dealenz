import type { SupabaseClient } from "@supabase/supabase-js"

// Notification store — owner-scoped rows, server-side writes, client
// reads + mark-read. Links are in-app paths only (validated at the DB).

export type NotificationType = "reminder" | "success" | "approval" | "status" | "signing"

export interface NotificationRow {
  id: string
  type: NotificationType
  title: string
  body: string
  link: string | null
  read_at: string | null
  created_at: string
}

export interface CreateNotification {
  userId: string
  type: NotificationType
  title: string
  body: string
  link?: string | null
}

const TYPES: NotificationType[] = ["reminder", "success", "approval", "status", "signing"]

export function validateNotification(input: CreateNotification): string | null {
  if (!TYPES.includes(input.type)) return "Invalid notification type."
  if (!input.userId) return "Missing user."
  if (!input.title || input.title.length > 120) return "Title must be 1–120 characters."
  if (!input.body || input.body.length > 500) return "Body must be 1–500 characters."
  if (input.link !== undefined && input.link !== null) {
    if (!input.link.startsWith("/") || input.link.length > 300) return "Link must be an in-app path."
  }
  return null
}

type Client = SupabaseClient

export async function createNotification(client: Client, input: CreateNotification): Promise<{ id: string }> {
  const err = validateNotification(input)
  if (err) throw new Error(err)
  const { data, error } = await client
    .from("notifications")
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title.slice(0, 120),
      body: input.body.slice(0, 500),
      link: input.link ?? null,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Could not create notification.")
  return { id: (data as { id: string }).id }
}

export async function listNotifications(client: Client, userId: string, limit = 30): Promise<{ items: NotificationRow[]; unread: number }> {
  const bounded = Math.max(1, Math.min(limit, 100))
  const { data, error } = await client
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(bounded)
  if (error) throw new Error(error.message)
  const items = ((data ?? []) as NotificationRow[]).filter((n) => TYPES.includes(n.type))
  return { items, unread: items.filter((n) => !n.read_at).length }
}

export async function markNotificationRead(client: Client, userId: string, id: string): Promise<void> {
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("read_at", null)
  if (error) throw new Error(error.message)
}

export async function markAllNotificationsRead(client: Client, userId: string): Promise<void> {
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
  if (error) throw new Error(error.message)
}

/** "2 min ago" style stamps for the panel. Pure. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ""
  const s = Math.max(0, Math.floor((now - t) / 1000))
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
