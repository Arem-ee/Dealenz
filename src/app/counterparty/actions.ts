// Counterparty research actions (P1: registry brief).
//
// Resolve → human confirm → research. Resolution costs the 1-credit micro
// floor; research costs the standard tier (6) and only when the brief
// carries at least one live Tier-1 claim — an all-UNKNOWN brief is returned
// as an error with the hold voided, never billed. Briefs persist as
// immutable rows keyed by idempotency key, so retried runs return the
// original instead of persisting twice.

"use server"

import { createClient } from "@/lib/supabase/server"
import { toActionFailure } from "@/lib/action-result"
import {
  finalizeReservation,
  reserveCredits,
  voidReservation,
  type LedgerClient,
} from "@/lib/credits/ledger"
import { COUNTERPARTY_RESOLVE_CREDITS, priceForOperation } from "@/lib/credits/pricing"
import { resolveCandidates } from "@/lib/counterparty/resolve"
import { assembleBrief } from "@/lib/counterparty/brief"
import {
  COUNTERPARTY_COUNTRIES,
  type BriefRow,
  type CounterpartyBrief,
  type CounterpartyCountry,
  type ResolutionCandidate,
} from "@/lib/counterparty/types"
import { getResearchAdapter, isSafeRetrievalUrl } from "@/lib/legal-research/retrieval"

const VERIFY_REQUIRED_ERROR = "Please verify your email address before using this feature."

export type ResolveResult = { ok: true; candidates: ResolutionCandidate[] } | { ok: false; error: string }
export type ResearchResult =
  | { ok: true; briefId: string; brief: CounterpartyBrief; balance: number | null }
  | { ok: false; error: string }

function ledgerFor(supabase: Awaited<ReturnType<typeof createClient>>): LedgerClient {
  return {
    rpc: async (functionName: string, args: Record<string, unknown> = {}) => {
      const result = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
        functionName,
        args
      )
      return { data: result.data, error: result.error }
    },
  }
}

function validCountry(value: unknown): value is CounterpartyCountry {
  return typeof value === "string" && (COUNTERPARTY_COUNTRIES as readonly string[]).includes(value)
}

function cleanString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null
  const v = value.trim().slice(0, max)
  return v.length > 0 ? v : null
}

export async function resolveCounterpartyAction(input: {
  name: string
  country: string
  region?: string | null
  domain?: string | null
  regNumber?: string | null
  idempotencyKey: string
}): Promise<ResolveResult> {
  try {
    const name = cleanString(input.name)
    if (!name || name.length < 2) return { ok: false, error: "Name the counterparty to research." }
    if (!validCountry(input.country)) return { ok: false, error: "Research is available in Nigeria, the United Kingdom, and the United States." }
    if (!input.idempotencyKey) return { ok: false, error: "A request key is required." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    // Abuse-rate cap on top of the credit charge: resolution fans out to
    // live registry search with network timeouts.
    const { checkRateLimit } = await import("@/lib/rate-limit")
    const rate = await checkRateLimit("counterparty_resolve")
    if (!rate.allowed) return { ok: false, error: rate.error ?? "You've reached today's usage limit. Please try again tomorrow." }

    const ledger = ledgerFor(supabase)
    const reservation = await reserveCredits(ledger, {
      operation: "counterparty_research",
      amount: COUNTERPARTY_RESOLVE_CREDITS,
      idempotencyKey: `resolve:${input.idempotencyKey}`.slice(0, 120),
    }).catch(() => null)
    if (!reservation?.allowed || !reservation.reservationId) {
      return { ok: false, error: `Insufficient credits for this operation. Resolution costs ${COUNTERPARTY_RESOLVE_CREDITS} credit.` }
    }
    try {
      const adapter = getResearchAdapter()
      const searchFn = adapter?.search
      const candidates = await resolveCandidates(
        {
          name,
          country: input.country,
          region: cleanString(input.region, 120),
          domain: cleanString(input.domain),
          regNumber: cleanString(input.regNumber, 40),
        },
        searchFn ? { search: (query: string, jurisdiction: string) => searchFn(query, jurisdiction) } : null
      )
      await finalizeReservation(ledger, {
        reservationId: reservation.reservationId,
        consumptionAmount: COUNTERPARTY_RESOLVE_CREDITS,
        operation: "counterparty_research",
      })
      return { ok: true, candidates }
    } catch (e) {
      await voidReservation(ledger, reservation.reservationId).catch(() => undefined)
      return toActionFailure(e, "We couldn't look up that counterparty. Nothing was charged.") as never
    }
  } catch (e) {
    return toActionFailure(e, "We couldn't look up that counterparty. Nothing was charged.") as never
  }
}

export async function researchCounterpartyAction(input: {
  name: string
  country: string
  region?: string | null
  domain?: string | null
  regNumber?: string | null
  /** Confirmed registry URL, or null for the details-only path. */
  url?: string | null
  sourceName?: string | null
  auditId?: string | null
  idempotencyKey: string
}): Promise<ResearchResult> {
  try {
    const name = cleanString(input.name)
    if (!name || name.length < 2) return { ok: false, error: "Name the counterparty to research." }
    if (!validCountry(input.country)) return { ok: false, error: "Research is available in Nigeria, the United Kingdom, and the United States." }
    if (!input.idempotencyKey) return { ok: false, error: "A request key is required." }
    // Never research a client-supplied URL that fails the registry safety
    // gate: researching an unvetted page under a confirmed label is how
    // misattribution happens. Invalid URLs fall back to details-only.
    const rawUrl = cleanString(input.url, 500)
    const url = rawUrl && isSafeRetrievalUrl(rawUrl).ok ? rawUrl : null
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false, error: VERIFY_REQUIRED_ERROR }
    const auditId = cleanString(input.auditId, 40)
    if (auditId) {
      const { data: owned } = await supabase
        .from("audits")
        .select("id")
        .eq("id", auditId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!owned) return { ok: false, error: "Deal not found." }
    }
    // Abuse-rate cap on top of the credit charge: research fans out to live
    // registry fetches with 8s timeouts per page.
    const { checkRateLimit } = await import("@/lib/rate-limit")
    const rate = await checkRateLimit("counterparty_research")
    if (!rate.allowed) return { ok: false, error: rate.error ?? "You've reached today's usage limit. Please try again tomorrow." }

    const price = priceForOperation("counterparty_research")
    const ledger = ledgerFor(supabase)
    const reservation = await reserveCredits(ledger, {
      operation: "counterparty_research",
      amount: price,
      idempotencyKey: `research:${input.idempotencyKey}`.slice(0, 120),
    }).catch(() => null)
    if (!reservation?.allowed || !reservation.reservationId) {
      return { ok: false, error: `Insufficient credits for this operation. A registry brief costs ${price} credits.` }
    }
    try {
      const adapter = getResearchAdapter()
      const searchFn = adapter?.search
      const brief = await assembleBrief({
        subject: {
          name,
          country: input.country,
          region: cleanString(input.region, 120),
          url,
          domain: cleanString(input.domain),
          regNumber: cleanString(input.regNumber, 40),
        },
        sourceName: cleanString(input.sourceName, 120),
        fetcher: adapter,
        searcher: searchFn ? { search: (query: string, jurisdiction: string) => searchFn(query, jurisdiction) } : null,
      })
      // Honest billing: an all-UNKNOWN brief helps nobody and bills nobody.
      if (!brief.liveVerified) {
        await voidReservation(ledger, reservation.reservationId).catch(() => undefined)
        return {
          ok: false,
          error: "The registries returned nothing usable for this party — nothing was charged. Check the name or registration number and try again.",
        }
      }
      const key = `brief:${input.idempotencyKey}`.slice(0, 120)
      const { error: persistError } = await supabase.from("counterparty_briefs").upsert(
        {
          user_id: user.id,
          audit_id: auditId,
          subject_name: name,
          country: input.country,
          region: cleanString(input.region, 120),
          brief: JSON.parse(JSON.stringify(brief)) as never,
          credits_charged: price,
          idempotency_key: key,
        } as never,
        { onConflict: "idempotency_key", ignoreDuplicates: true }
      )
      if (persistError) {
        await voidReservation(ledger, reservation.reservationId).catch(() => undefined)
        return { ok: false, error: "Research succeeded but the brief couldn't be saved — nothing was charged. Please try again." }
      }
      const { data: row } = await supabase
        .from("counterparty_briefs")
        .select("id")
        .eq("idempotency_key", key)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!row) {
        await voidReservation(ledger, reservation.reservationId).catch(() => undefined)
        return { ok: false, error: "Research succeeded but the brief couldn't be saved — nothing was charged. Please try again." }
      }
      const finalized = await finalizeReservation(ledger, {
        reservationId: reservation.reservationId,
        consumptionAmount: price,
        operation: "counterparty_research",
      }).catch(() => null)
      return { ok: true, briefId: (row as { id: string }).id, brief, balance: finalized?.balance ?? null }
    } catch (e) {
      await voidReservation(ledger, reservation.reservationId).catch(() => undefined)
      return toActionFailure(e, "Research failed — nothing was charged. Please try again.") as never
    }
  } catch (e) {
    return toActionFailure(e, "Research failed — nothing was charged. Please try again.") as never
  }
}

export async function getCounterpartyBriefAction(
  briefId: string
): Promise<{ ok: true; brief: BriefRow } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    const { data, error } = await supabase
      .from("counterparty_briefs")
      .select("id, audit_id, subject_name, brief, credits_charged, created_at")
      .eq("id", briefId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (error || !data) return { ok: false, error: "Brief not found." }
    const row = data as { id: string; audit_id: string | null; subject_name: string; brief: CounterpartyBrief; credits_charged: number; created_at: string }
    return {
      ok: true,
      brief: {
        id: row.id,
        auditId: row.audit_id,
        subjectName: row.subject_name,
        brief: row.brief,
        creditsCharged: row.credits_charged,
        createdAt: row.created_at,
      },
    }
  } catch (e) {
    return toActionFailure(e, "We couldn't load that brief.") as never
  }
}

export async function counterpartyDefaultsAction(
  auditId: string
): Promise<{ ok: true; country: CounterpartyCountry | null } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "You must be signed in." }
    const { data: audit } = await supabase
      .from("audits")
      .select("context_envelope")
      .eq("id", auditId)
      .eq("user_id", user.id)
      .maybeSingle()
    const fields = (audit as { context_envelope?: { fields?: Record<string, { value?: unknown }> } } | null)?.context_envelope?.fields
    const jurisdiction = typeof fields?.jurisdiction?.value === "string" ? fields.jurisdiction.value.toLowerCase() : ""
    let country: CounterpartyCountry | null = null
    if (jurisdiction.includes("nigeria")) country = "Nigeria"
    else if (jurisdiction.includes("united kingdom") || jurisdiction === "uk" || jurisdiction.includes("england")) country = "United Kingdom"
    else if (jurisdiction.includes("united states") || jurisdiction === "us" || jurisdiction === "usa") country = "United States"
    return { ok: true, country }
  } catch (e) {
    return toActionFailure(e, "We couldn't read that deal.") as never
  }
}
