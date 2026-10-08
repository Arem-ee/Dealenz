import type { SupabaseClient } from "@supabase/supabase-js"
import { createNotification, type NotificationCategory, type NotificationType } from "./store"

// Deal-scoped owner notification: resolves the deal owner + title from
// the audit and writes one row. Best-effort by contract — callers never
// let a notification failure break the ceremony it reports on.

export async function notifyDealOwner(
  client: SupabaseClient,
  auditId: string,
  input: { type: NotificationType; title: string; body: string; link?: string | null; category?: NotificationCategory }
): Promise<void> {
  const { data: audit } = await client
    .from("audits")
    .select("user_id, title")
    .eq("id", auditId)
    .maybeSingle()
  const row = audit as { user_id?: string; title?: string | null } | null
  if (!row?.user_id) return
  const title = input.title.slice(0, 120)
  const body = input.body.slice(0, 500)
  try {
    await createNotification(client, {
      userId: row.user_id,
      type: input.type,
      title,
      body,
      link: input.link ?? null,
      ...(input.category ? { category: input.category } : {}),
    })
  } catch {
    // Notification delivery never breaks the underlying event.
  }
}
