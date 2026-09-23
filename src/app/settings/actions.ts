"use server"

import { createClient } from "@/lib/supabase/server"

// Self-service data export (GDPR portability): one JSON document with
// everything the product holds about the caller — deals, threads, documents,
// monitoring, billing history, and profile. Every query is owner-scoped;
// bounded limits keep the payload downloadable. Returns (never throws) so
// the UI can offer the download or explain the failure honestly.
const LIMITS = {
  audits: 200,
  conversations: 200,
  messages: 2000,
  versions: 500,
  monitoringEvents: 200,
  ledger: 500,
  purchases: 100,
}

export interface DataExport {
  exportedAt: string
  user: { id: string; email: string | null }
  businessProfile: Record<string, unknown> | null
  audits: unknown[]
  conversations: unknown[]
  messages: unknown[]
  documentVersions: unknown[]
  monitoringEvents: unknown[]
  creditLedger: unknown[]
  creditPurchases: unknown[]
}

export async function exportMyData(): Promise<{ ok: true; export: DataExport } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Unauthorized" }
  }

  try {
    const { data: profile } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
    const { data: audits } = await supabase
      .from("audits")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIMITS.audits)
    const { data: conversations } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIMITS.conversations)
    const conversationIds = ((conversations ?? []) as Array<{ id: unknown }>)
      .map((c) => c.id)
      .filter((id): id is string => typeof id === "string")
    const { data: messages } = conversationIds.length > 0
      ? await supabase
          .from("conversation_messages")
          .select("*")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
          .limit(LIMITS.messages)
      : { data: [] }
    const { data: versions } = await supabase
      .from("document_versions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIMITS.versions)
    const { data: events } = await supabase
      .from("monitoring_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIMITS.monitoringEvents)
    const { data: ledger } = await supabase
      .from("credit_ledger")
      .select("id, entry_type, amount, operation, status, idempotency_key, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIMITS.ledger)
    const { data: purchases } = await supabase
      .from("credit_purchases")
      .select("id, package_id, credits, amount_minor, currency, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIMITS.purchases)

    return {
      ok: true,
      export: {
        exportedAt: new Date().toISOString(),
        user: { id: user.id, email: user.email ?? null },
        businessProfile: (profile as Record<string, unknown> | null) ?? null,
        audits: (audits ?? []) as unknown[],
        conversations: (conversations ?? []) as unknown[],
        messages: (messages ?? []) as unknown[],
        documentVersions: (versions ?? []) as unknown[],
        monitoringEvents: (events ?? []) as unknown[],
        creditLedger: (ledger ?? []) as unknown[],
        creditPurchases: (purchases ?? []) as unknown[],
      },
    }
  } catch {
    return { ok: false, error: "We couldn't assemble your export. Please try again." }
  }
}
