"use server"

import { createClient } from "@/lib/supabase/server"
import { toActionFailure } from "@/lib/action-result"
import { getValidGmailTokens } from "@/lib/gmail/tokens"
import { getGmailMessage, getGmailThread, listGmailThreads } from "@/lib/gmail/api"
import { createConversation } from "@/lib/conversation/store"

// Inbox import (P3 obligation-repository input): the user's own recent
// threads, listed with subject/sender/date, imported as new deals on
// explicit per-thread action. Read-only listing needs auth only (own data,
// like monitoring reads); importing creates a deal like any other entry.
// Dedupe by provider thread id stored on the audit; re-import returns the
// existing state instead of duplicating.

export interface InboxThreadItem {
  threadId: string
  subject: string | null
  from: string | null
  date: string | null
  snippet: string | null
}

export interface InboxMessageItem {
  subject: string | null
  from: string | null
  date: string | null
  bodyText: string | null
}

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isUUID(user.id)) return null
  return { supabase, user }
}

export async function getInboxStatus(): Promise<{ ok: true; connected: boolean } | { ok: false; error: string }> {
  try {
    const ctx = await requireUser()
    if (!ctx) return { ok: false as const, error: "You must be signed in." }
    const tokens = await import("@/lib/gmail/tokens").then((m) => m.getGmailTokens(ctx.supabase as never, ctx.user.id))
    return { ok: true as const, connected: tokens !== null }
  } catch (e) {
    return toActionFailure(e, "Could not check Gmail status.") as never
  }
}

export async function listInboxThreads(): Promise<
  | { ok: true; connected: true; threads: InboxThreadItem[] }
  | { ok: true; connected: false }
  | { ok: false; error: string }
> {
  try {
    const ctx = await requireUser()
    if (!ctx) return { ok: false as const, error: "You must be signed in." }
    const tokens = await getValidGmailTokens(ctx.supabase as never, ctx.user.id).catch(() => null)
    if (!tokens) return { ok: true as const, connected: false as const }
    const listed = await listGmailThreads(tokens.access_token, { maxResults: 10 })
    const items: InboxThreadItem[] = []
    for (const t of listed.threads.slice(0, 10)) {
      try {
        const thread = await getGmailThread(tokens.access_token, t.id)
        const firstId = thread.messageIds[0]
        if (!firstId) {
          items.push({ threadId: t.id, subject: null, from: null, date: null, snippet: t.snippet ?? null })
          continue
        }
        const msg = await getGmailMessage(tokens.access_token, firstId)
        items.push({ threadId: t.id, subject: msg.subject, from: msg.from, date: msg.date, snippet: msg.snippet ?? t.snippet ?? null })
      } catch {
        items.push({ threadId: t.id, subject: null, from: null, date: null, snippet: t.snippet ?? null })
      }
    }
    return { ok: true as const, connected: true as const, threads: items }
  } catch (e) {
    return toActionFailure(e, "Could not list inbox threads.") as never
  }
}

// Thread preview for the Inbox view: the messages behind a row, so the user
// can read before importing. Bodies are capped per message; the full text
// travels only on explicit import.
export async function getInboxThreadDetail(
  threadId: string
): Promise<{ ok: true; messages: InboxMessageItem[] } | { ok: false; error: string }> {
  try {
    const ctx = await requireUser()
    if (!ctx) return { ok: false as const, error: "You must be signed in." }
    if (typeof threadId !== "string" || threadId.length === 0 || threadId.length > 128) {
      return { ok: false as const, error: "Invalid thread." }
    }
    const tokens = await getValidGmailTokens(ctx.supabase as never, ctx.user.id).catch(() => null)
    if (!tokens) return { ok: false as const, error: "Connect Gmail first." }
    const thread = await getGmailThread(tokens.access_token, threadId)
    const messages: InboxMessageItem[] = []
    for (const mid of thread.messageIds.slice(0, 5)) {
      try {
        const m = await getGmailMessage(tokens.access_token, mid)
        messages.push({
          subject: m.subject,
          from: m.from,
          date: m.date,
          bodyText: (m.bodyText ?? "").slice(0, 2000) || null,
        })
      } catch {
        // One unreadable message must not block the rest.
      }
    }
    if (messages.length === 0) return { ok: false as const, error: "Could not read that thread." }
    return { ok: true as const, messages }
  } catch (e) {
    return toActionFailure(e, "Could not read that thread.") as never
  }
}

function formatImportedThread(messages: Array<{ subject: string | null; from: string | null; date: string | null; bodyText: string | null }>): string {  return messages
    .map((m) =>
      [
        m.subject ? `Subject: ${m.subject}` : null,
        m.from ? `From: ${m.from}` : null,
        m.date ? `Date: ${m.date}` : null,
        "",
        (m.bodyText ?? "").slice(0, 4000),
      ]
        .filter((l) => l !== null)
        .join("\n")
    )
    .join("\n\n--- message ---\n\n")
    .slice(0, 20000)
}

export async function importInboxThread(
  threadId: string
): Promise<{ ok: true; threadId: string; duplicate: boolean } | { ok: false; error: string }> {
  try {
    const ctx = await requireUser()
    if (!ctx) return { ok: false as const, error: "You must be signed in." }
    if (typeof threadId !== "string" || threadId.length === 0 || threadId.length > 128) {
      return { ok: false as const, error: "Invalid thread." }
    }

    // Dedupe: an audit already imported from this provider thread returns
    // its existing conversation instead of duplicating the deal.
    const { data: recent } = await ctx.supabase
      .from("audits")
      .select("id, structured_data")
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(50)
    const rows = ((recent ?? []) as Array<{ id: string; structured_data?: Record<string, unknown> | null }>)
    const dup = rows.find((r) => r.structured_data && (r.structured_data as Record<string, unknown>).importedGmailThreadId === threadId)
    if (dup) {
      const { data: conv } = await ctx.supabase
        .from("conversations")
        .select("id")
        .eq("attached_audit_id", dup.id)
        .eq("user_id", ctx.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      const convId = (conv as { id: string } | null)?.id
      if (convId) return { ok: true as const, threadId: convId, duplicate: true as const }
      return { ok: false as const, error: "This thread was already imported." }
    }

    const tokens = await getValidGmailTokens(ctx.supabase as never, ctx.user.id).catch(() => null)
    if (!tokens) return { ok: false as const, error: "Connect Gmail first." }
    const thread = await getGmailThread(tokens.access_token, threadId)
    const messages = []
    for (const mid of thread.messageIds.slice(0, 5)) {
      try {
        messages.push(await getGmailMessage(tokens.access_token, mid))
      } catch {
        // One unreadable message must not block the rest.
      }
    }
    if (messages.length === 0) return { ok: false as const, error: "Could not read that thread." }
    const first = messages[0]
    const title = (first.subject ?? "Imported email").slice(0, 120) || "Imported email"
    const rawInput = formatImportedThread(messages)
    if (rawInput.trim().length === 0) return { ok: false as const, error: "That thread has no readable text." }

    const { data: audit, error: auditError } = await ctx.supabase
      .from("audits")
      .insert({
        user_id: ctx.user.id,
        title,
        status: "draft",
        deal_type: "generic",
        raw_input: rawInput,
        structured_data: { files: [], importedGmailThreadId: threadId, importedFrom: "gmail" },
      })
      .select("id")
      .single()
    if (auditError || !audit) return { ok: false as const, error: "Could not create the deal." }
    const auditId = (audit as { id: string }).id
    const conv = await createConversation(ctx.supabase as never, ctx.user.id, {
      firstText: title,
      attachedAuditId: auditId,
    }).catch(() => null)
    if (!conv) return { ok: false as const, error: "Deal created, but we couldn't open its chat. Find it in recent threads." }
    return { ok: true as const, threadId: conv.id, duplicate: false as const }
  } catch (e) {
    return toActionFailure(e, "Could not import that thread.") as never
  }
}
