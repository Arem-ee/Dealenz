"use server"

import { createClient } from "@/lib/supabase/server"
import { toActionFailure } from "@/lib/action-result"
import {
  getNotificationPrefs,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPref,
  type NotificationCategory,
} from "./store"

// Server boundary for the notification center. Reads and mark-read are
// owner-scoped by RLS; creation happens server-side in event writers
// (signing lifecycle, expiry cron, later approvals) — never from client
// input beyond the row id being marked.

export async function getNotifications(limit = 30) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const state = await listNotifications(supabase, user.id, limit)
    return { ok: true as const, ...state }
  } catch (e) {
    return toActionFailure(e, "Could not load notifications.") as never
  }
}

export async function markNotificationReadAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    await markNotificationRead(supabase, user.id, id)
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "Could not mark that read.") as never
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    await markAllNotificationsRead(supabase, user.id)
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "Could not mark all read.") as never
  }
}

export async function getNotificationPrefsAction() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const prefs = await getNotificationPrefs(supabase, user.id)
    return { ok: true as const, prefs }
  } catch (e) {
    return toActionFailure(e, "Could not load notification settings.") as never
  }
}

export async function setNotificationPrefAction(key: NotificationCategory, value: boolean) {
  try {
    if (key !== "approval_requests" && key !== "deadline_digests") {
      return { ok: false as const, error: "Unknown setting." }
    }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    await setNotificationPref(supabase, user.id, key, value)
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "Could not save that setting.") as never
  }
}
