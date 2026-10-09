"use server"

import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { isNonEnglishLocale } from "@/lib/i18n/locale"
import { isLibraryVariant, type LibraryClauseVariant } from "@/lib/library/entries"
import { evaluateClauseRound, isNegotiationStance, type NegotiationStance } from "@/lib/negotiation/round"
import { authorizeOperation, completeOperation } from "@/lib/credits/policy"
import { STANDARD_CREDIT_POLICY } from "@/lib/credits/pricing"
import { checkRateLimit } from "@/lib/rate-limit"

export interface RoundPositionView {
  clauseId: string
  outcome: "accept" | "fallback" | "escalate" | "route"
  variant: LibraryClauseVariant | null
  rung: number | null
  reasoning: string
  counterText: string
}

export interface NegotiationRoundView {
  id: string
  roundNo: number
  stance: NegotiationStance
  status: string
  proposerKind: string
  agreedVersionId: string | null
  createdAt: string
  positions: RoundPositionView[]
}

export interface NegotiationCommentView {
  id: string
  channel: "internal" | "external"
  body: string
  resolved: boolean
  authorLabel: string
  createdAt: string
}

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ROUND_CLAUSES = 10

interface LadderSlot {
  variant: LibraryClauseVariant
  rung: number
  body: string
  version: number
  condition: string
  insertOnMissing: boolean
  /** Language the body resolved in — English fallback labeled, never silent. */
  bodyLanguage: string
}

/**
 * Paired ladder per clause, bodies at latest usable versions. When a
 * response language is requested, rung bodies resolve in that language
 * with English fallback per clause (D4 + agreement-language D3).
 */
async function laddersForAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  language?: string
): Promise<Map<string, { links: LadderSlot[] }>> {
  const { data: linkRows } = await supabase
    .from("position_clause_links")
    .select("library_key, variant, rung, condition_text, insert_on_missing, position_id")
    .eq("user_id", userId)
    .limit(500)
  const { data: libRows } = await supabase
    .from("library_clauses")
    .select("key, variant, version, body, status, language")
    .eq("user_id", userId)
    .limit(500)
  const wantLang = isNonEnglishLocale(language) ? language : "en"
  const heads = new Map<string, { body: string; version: number; language: string }>()
  for (const r of ((libRows ?? []) as Array<{
    key: string; variant: unknown; version: number; body: string; status: unknown; language: unknown
  }>)) {
    if (!isLibraryVariant(r.variant)) continue
    if (r.status !== "active" && r.status !== "deprecated") continue
    if (typeof r.body !== "string" || typeof r.version !== "number") continue
    const lang = isNonEnglishLocale(r.language) ? (r.language as string) : "en"
    const slot = `${r.key}:${r.variant}:${lang}`
    const cur = heads.get(slot)
    if (!cur || r.version > cur.version) heads.set(slot, { body: r.body, version: r.version, language: lang })
  }
  const headFor = (key: string, variant: string) =>
    heads.get(`${key}:${variant}:${wantLang}`) ?? heads.get(`${key}:${variant}:en`) ?? null
  // Links address standard keys; tracked clause ids are template ids.
  const byClause = new Map<string, { links: LadderSlot[] }>()
  for (const l of ((linkRows ?? []) as Array<{
    library_key: string; variant: unknown; rung: number; condition_text: string | null;
    insert_on_missing: boolean
  }>)) {
    if (!isLibraryVariant(l.variant)) continue
    const head = headFor(l.library_key, l.variant)
    if (!head) continue
    const clauseId = l.library_key.startsWith("std:") ? l.library_key.slice(4) : null
    if (!clauseId) continue
    const entry = byClause.get(clauseId) ?? { links: [] }
    entry.links.push({
      variant: l.variant,
      rung: typeof l.rung === "number" ? l.rung : 0,
      body: head.body,
      version: head.version,
      condition: l.condition_text ?? "",
      insertOnMissing: l.insert_on_missing === true,
      bodyLanguage: head.language,
    })
    byClause.set(clauseId, entry)
  }
  return byClause
}

/** Rungs already offered for a clause across earlier rounds (never re-offered). */
async function offeredRungs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  auditId: string,
  clauseId: string
): Promise<number[]> {
  const { data: rounds } = await supabase
    .from("negotiation_rounds")
    .select("id")
    .eq("user_id", userId)
    .eq("audit_id", auditId)
    .limit(50)
  const ids = ((rounds ?? []) as Array<{ id: string }>).map((r) => r.id)
  if (ids.length === 0) return []
  const { data: positions } = await supabase
    .from("round_clause_positions")
    .select("rung")
    .in("round_id", ids)
    .eq("clause_id", clauseId)
    .eq("outcome", "fallback")
  return ((positions ?? []) as Array<{ rung: number | null }>)
    .map((p) => p.rung)
    .filter((r): r is number => typeof r === "number")
}

/**
 * Starts a negotiation round: per-clause counterparty positions evaluated
 * through the four-outcome engine, counter-language drafted for fallback
 * outcomes, everything stored with reasoning. Current language resolves
 * best-first: recorded span slice (D1) → located staged-redline span with
 * verification (D2) → owner-attested paste. Provenance rides the reasoning
 * text so every outcome says where its input came from.
 * Credit-gated like any priced AI operation (negotiation tier).
 */
export async function startRound(input: {
  auditId: string
  baseVersionId?: string | null
  stance?: NegotiationStance
  grantId?: string | null
  stagedUploadId?: string | null
  clauses: Array<{ clauseId: string; mode: "stands" | "counter" | "missing"; counterText?: string }>
}): Promise<ActionOk<{ round: NegotiationRoundView }> | ActionFail> {
  if (!UUID_RE.test(input.auditId)) return { ok: false, error: "Invalid deal." }
  const stance = isNegotiationStance(input.stance) ? input.stance : "balanced"
  const clauses = (input.clauses ?? []).slice(0, MAX_ROUND_CLAUSES)
  if (clauses.length === 0) return { ok: false, error: "Add at least one clause to the round." }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: audit } = await supabase
    .from("audits")
    .select("id")
    .eq("id", input.auditId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!audit) return { ok: false, error: "Deal not found." }

  let baseVersionId: string | null = null
  if (input.baseVersionId) {
    if (!UUID_RE.test(input.baseVersionId)) return { ok: false, error: "Invalid base version." }
    const { data: base } = await supabase
      .from("document_versions")
      .select("id")
      .eq("id", input.baseVersionId)
      .eq("audit_id", input.auditId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!base) return { ok: false, error: "Base version not found." }
    baseVersionId = (base as { id: string }).id
  }

  // Optional counterparty attribution: a live guest grant on this deal.
  let grantId: string | null = null
  if (input.grantId) {
    if (!UUID_RE.test(input.grantId)) return { ok: false, error: "Invalid grant." }
    const { data: grant } = await supabase
      .from("guest_grants")
      .select("id")
      .eq("id", input.grantId)
      .eq("deal_id", input.auditId)
      .is("revoked_at", null)
      .maybeSingle()
    if (!grant) return { ok: false, error: "That guest grant is no longer live." }
    grantId = (grant as { id: string }).id
  }

  // Response language (i18n D4): profile locale steers rung bodies and
  // counter-language prose; ladder logic and verdicts stay language-free.
  let responseLanguage = "en"
  try {
    const { data: profile } = await supabase
      .from("business_profiles")
      .select("locale")
      .eq("user_id", user.id)
      .maybeSingle()
    const stored = (profile as { locale?: unknown } | null)?.locale
    if (isNonEnglishLocale(stored)) responseLanguage = stored
  } catch {
    responseLanguage = "en"
  }
  const ladders = await laddersForAudit(supabase, user.id, responseLanguage)

  // Base version for recorded spans: explicit base or the latest version.
  let spanVersion: { id: string; content: string | null } | null = null
  if (baseVersionId) {
    const { data: base } = await supabase
      .from("document_versions")
      .select("id, content")
      .eq("id", baseVersionId)
      .eq("audit_id", input.auditId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (base) spanVersion = base as { id: string; content: string | null }
  }
  if (!spanVersion) {
    const { data: latest } = await supabase
      .from("document_versions")
      .select("id, content")
      .eq("audit_id", input.auditId)
      .eq("user_id", user.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest) spanVersion = latest as { id: string; content: string | null }
  }
  const spanByClause = new Map<string, string>()
  if (spanVersion) {
    const { data: spans } = await supabase
      .from("version_clause_spans")
      .select("clause_id, start_offset, end_offset")
      .eq("version_id", spanVersion.id)
      .eq("user_id", user.id)
      .limit(100)
    const content = spanVersion.content ?? ""
    for (const s of ((spans ?? []) as Array<{ clause_id: string; start_offset: number; end_offset: number }>)) {
      if (s.start_offset >= 0 && s.end_offset > s.start_offset && s.end_offset <= content.length + 1) {
        spanByClause.set(s.clause_id, content.slice(s.start_offset, Math.min(s.end_offset, content.length)))
      }
    }
  }

  // Staged redline text for locate-with-verification (third-party text).
  let stagedText: string | null = null
  if (input.stagedUploadId) {
    if (!UUID_RE.test(input.stagedUploadId)) return { ok: false, error: "Invalid staged file." }
    const { data: staged } = await supabase
      .from("staged_uploads")
      .select("id, storage_path, mime")
      .eq("id", input.stagedUploadId)
      .eq("deal_id", input.auditId)
      .maybeSingle()
    const stagedRow = staged as { id: string; storage_path: string; mime: string } | null
    if (stagedRow) {
      const { data: file } = await supabase.storage.from("audit-files").download(stagedRow.storage_path)
      if (file) {
        try {
          const { extractTextFromBuffer } = await import("@/lib/text-extract")
          const buf = Buffer.from(await file.arrayBuffer())
          stagedText = (await extractTextFromBuffer(buf, stagedRow.mime)).slice(0, 100_000)
        } catch {
          stagedText = null
        }
      }
    }
  }

  const cap = await checkRateLimit("negotiation_round")
  if (!cap.allowed) return { ok: false, error: cap.error ?? "You've reached today's negotiation limit. Please try again tomorrow." }

  const totalChars = clauses.reduce((n, c) => n + (c.counterText ?? "").length, 0)
  const authorization = await authorizeOperation({
    ledger: supabase as never,
    userId: user.id,
    operation: "negotiation",
    idempotencyKey: randomUUID(),
    policy: STANDARD_CREDIT_POLICY,
    inputChars: totalChars,
  })
  if (!authorization.authorized) {
    return { ok: false, error: authorization.denialReason ?? "Insufficient credits for this round." }
  }

  const { data: existing } = await supabase
    .from("negotiation_rounds")
    .select("round_no")
    .eq("user_id", user.id)
    .eq("audit_id", input.auditId)
    .order("round_no", { ascending: false })
    .limit(1)
    .maybeSingle()
  const roundNo = (typeof (existing as { round_no?: number } | null)?.round_no === "number"
    ? (existing as { round_no: number }).round_no
    : 0) + 1

  const { draftCounterLanguage } = await import("@/lib/ai/negotiation")
  const { data: round, error: roundError } = await supabase
    .from("negotiation_rounds")
    .insert({
      user_id: user.id,
      audit_id: input.auditId,
      round_no: roundNo,
      base_version_id: baseVersionId,
      proposer_kind: "owner",
      grant_id: grantId,
      stance,
      status: "proposed",
    })
    .select("id")
    .single()
  if (roundError || !round) {
    await completeOperation({
      ledger: supabase as never, authorization, operation: "negotiation",
      status: "pre_provider_failure", policy: STANDARD_CREDIT_POLICY, inputChars: totalChars,
    }).catch(() => undefined)
    return { ok: false, error: "We couldn't open that round. Please try again." }
  }
  const roundId = (round as { id: string }).id
  let measuredIn = 0
  let measuredOut = 0
  const views: RoundPositionView[] = []

  try {
    const { locateSpan } = await import("@/lib/evidence/locate")
    for (const c of clauses) {
      const clauseId = (c.clauseId ?? "").trim().slice(0, 120)
      if (!clauseId) continue
      const ladder = ladders.get(clauseId)
      const anchored = spanByClause.get(clauseId) ?? null
      if (c.mode === "stands") {
        // Recorded spans verify the claim: standing text matching
        // preferred accepts on evidence; drifted text routes instead of
        // accepting blindly. Unanchored stands stay explicitly attested.
        const preferredBody = ladder?.links.find((l) => l.variant === "preferred")?.body ?? null
        if (anchored && preferredBody) {
          const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim()
          if (norm(anchored) === norm(preferredBody)) {
            views.push({
              clauseId, outcome: "accept", variant: "preferred", rung: 0,
              reasoning: "Standing language verified against the recorded span — matches preferred.",
              counterText: "",
            })
            continue
          }
          views.push({
            clauseId, outcome: "route", variant: null, rung: null,
            reasoning: "Standing text drifted from preferred — review before accepting.",
            counterText: anchored.slice(0, 4000),
          })
          continue
        }
        views.push({
          clauseId, outcome: "accept", variant: null, rung: null,
          reasoning: "Owner confirms standing language — unanchored, owner-attested.",
          counterText: "",
        })
        continue
      }
      if (!ladder) {
        views.push({
          clauseId, outcome: "route", variant: null, rung: null,
          reasoning: "Unpaired clause — route to legal with the diff.",
          counterText: (c.counterText ?? "").slice(0, 4000),
        })
        continue
      }
      // Current language under evaluation. Our recorded span never
      // satisfies their counter — evaluating our own text as theirs
      // would accept by construction. Provenance rides the reasoning.
      // - missing → silence path (null)
      // - counter + paste → attested wording
      // - counter + staged file → verified locate (EXACT/APPROXIMATE)
      // - counter otherwise → route, needs wording
      // - stands → accept (span presence only flavors the note)
      let currentText: string | null = null
      let provenance = ""
      if (c.mode === "missing") {
        currentText = null
      } else if (c.mode === "counter") {
        if ((c.counterText ?? "").trim()) {
          currentText = c.counterText!.trim().slice(0, 4000)
          provenance = "Owner-attested wording. "
        } else if (stagedText) {
          const preferred = ladder.links.find((l) => l.variant === "preferred")
          const located = preferred ? locateSpan(stagedText, preferred.body) : { kind: "UNAVAILABLE" as const }
          if (located.kind === "EXACT") {
            currentText = stagedText.slice(located.startOffset, located.endOffset)
            provenance = "Located EXACT in the staged redline. "
          } else if (located.kind === "APPROXIMATE") {
            currentText = stagedText.slice(located.startOffset, located.endOffset)
            provenance = `Located APPROXIMATE (score ${located.score}) in the staged redline — confirm before relying on it. `
          }
        }
        if (currentText === null) {
          views.push({
            clauseId, outcome: "route", variant: null, rung: null,
            reasoning: "Counterparty wording needed — paste it or pick their staged file.",
            counterText: "",
          })
          continue
        }
      }
      const preferred = ladder.links.find((l) => l.variant === "preferred")
      const fallbacks = ladder.links
        .filter((l) => l.variant === "fallback")
        .map((l, i) => ({ rung: i + 1, variant: l.variant as Exclude<LibraryClauseVariant, "preferred">, body: l.body, condition: l.condition }))
      const walkaway = ladder.links.find((l) => l.variant === "walkaway")
      const offered = await offeredRungs(supabase, user.id, input.auditId, clauseId)
      const evaluated = evaluateClauseRound({
        clauseId,
        currentText: c.mode === "missing" ? null : currentText,
        preferredBody: preferred?.body ?? "",
        preferredVersion: preferred?.version ?? 0,
        fallbacks: fallbacks.map(({ rung, variant, body }) => ({ rung, variant, body })),
        walkawayBody: walkaway?.body ?? null,
        alreadyOfferedRungs: offered,
        insertOnMissing: ladder.links.some((l) => l.variant === "preferred" && l.insertOnMissing),
        stance,
      })
      evaluated.reasoning = `${provenance}${evaluated.reasoning}`.slice(0, 1000)
      let counterText = (c.counterText ?? "").slice(0, 4000)
      if (evaluated.outcome === "fallback" && evaluated.offeredBody) {
        try {
          const rungLink = fallbacks.find((f) => f.rung === evaluated.rung)
          const drafted = await draftCounterLanguage({
            clauseTitle: clauseId,
            counterpartyText: counterText || "(no counterparty wording recorded)",
            rungBody: evaluated.offeredBody,
            rung: evaluated.rung ?? 0,
            condition: rungLink?.condition ?? "",
            language: responseLanguage,
          })
          counterText = drafted.text
          if (drafted.usage) {
            measuredIn += drafted.usage.inputTokens
            measuredOut += drafted.usage.outputTokens
          }
        } catch {
          counterText = evaluated.offeredBody
        }
      }
      views.push({
        clauseId,
        outcome: evaluated.outcome,
        variant: evaluated.variant,
        rung: evaluated.rung,
        reasoning: `${provenance}${evaluated.reasoning}`.slice(0, 1000),
        counterText,
      })
    }

    const { error: posError } = await supabase.from("round_clause_positions").insert(
      views.map((v) => ({
        user_id: user.id,
        round_id: roundId,
        clause_id: v.clauseId,
        outcome: v.outcome,
        rung: v.rung,
        variant: v.variant,
        reasoning: v.reasoning.slice(0, 1000),
        counter_text: v.counterText.slice(0, 8000),
      }))
    )
    if (posError) throw new Error(posError.message)
    const completion = await completeOperation({
      ledger: supabase as never, authorization, operation: "negotiation",
      usage: measuredIn + measuredOut > 0 ? { inputTokens: measuredIn, outputTokens: measuredOut } : undefined,
      status: "success", policy: STANDARD_CREDIT_POLICY, inputChars: totalChars,
    }).catch(() => null)
    const { logAIUsage, toUsageRecord } = await import("@/lib/ai/usage")
    const usageRecord = toUsageRecord({
      operation: "negotiation", provider: "negotiation-round", model: "round-evaluation",
      usage: measuredIn + measuredOut > 0 ? { inputTokens: measuredIn, outputTokens: measuredOut } : undefined,
      status: "success",
    })
    if (completion) usageRecord.creditsConsumed = completion.record.creditsConsumed
    await logAIUsage(usageRecord, { auditId: input.auditId, userId: user.id }).catch(() => undefined)
  } catch (err) {
    await supabase.from("negotiation_rounds").delete().eq("id", roundId).eq("user_id", user.id)
    await completeOperation({
      ledger: supabase as never, authorization, operation: "negotiation",
      status: "provider_failure", policy: STANDARD_CREDIT_POLICY, inputChars: totalChars,
    }).catch(() => undefined)
    return { ok: false, error: err instanceof Error ? "We couldn't evaluate that round. Please try again." : "We couldn't evaluate that round. Please try again." }
  }

  return {
    ok: true,
    round: {
      id: roundId, roundNo, stance, status: "proposed", proposerKind: "owner",
      agreedVersionId: null, createdAt: new Date().toISOString(), positions: views,
    },
  }
}

/** Owner disposes a round: accept (optionally naming the agreed version), counter (open another), withdraw. */
export async function decideRound(input: {
  roundId: string
  verdict: "accepted" | "withdrawn"
  agreedVersionId?: string | null
}): Promise<ActionOk<{ status: string }> | ActionFail> {
  if (!UUID_RE.test(input.roundId)) return { ok: false, error: "Invalid round." }
  if (input.verdict !== "accepted" && input.verdict !== "withdrawn") {
    return { ok: false, error: "Unknown verdict." }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: round } = await supabase
    .from("negotiation_rounds")
    .select("id, audit_id, status")
    .eq("id", input.roundId)
    .eq("user_id", user.id)
    .maybeSingle()
  const row = round as { id: string; audit_id: string; status: string } | null
  if (!row || row.status !== "proposed") return { ok: false, error: "That round is already decided." }
  // Resolve-before-agreed (D4): counterparty-visible threads must close
  // before a round is accepted. Internal threads stay advisory.
  if (input.verdict === "accepted") {
    const { data: openExternal } = await supabase
      .from("negotiation_comments")
      .select("id")
      .eq("user_id", user.id)
      .eq("round_id", row.id)
      .eq("channel", "external")
      .is("resolved_at", null)
      .limit(1)
    if ((openExternal ?? []).length > 0) {
      return { ok: false, error: "Open counterparty threads must resolve before this round is accepted." }
    }
  }
  let agreedVersionId: string | null = null
  if (input.verdict === "accepted" && input.agreedVersionId) {
    if (!UUID_RE.test(input.agreedVersionId)) return { ok: false, error: "Invalid agreed version." }
    const { data: version } = await supabase
      .from("document_versions")
      .select("id")
      .eq("id", input.agreedVersionId)
      .eq("audit_id", row.audit_id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!version) return { ok: false, error: "Agreed version not found on this deal." }
    agreedVersionId = (version as { id: string }).id
  }
  const { error } = await supabase
    .from("negotiation_rounds")
    .update({ status: input.verdict === "accepted" ? "accepted" : "withdrawn", agreed_version_id: agreedVersionId, decided_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("user_id", user.id)
    .eq("status", "proposed")
  if (error) return { ok: false, error: "We couldn't record that decision. Please try again." }
  return { ok: true, status: input.verdict === "accepted" ? "accepted" : "withdrawn" }
}

/** Rounds with positions and both comment channels (owner sees all). */
export async function listRounds(auditId: string): Promise<
  ActionOk<{ rounds: Array<NegotiationRoundView & { comments: NegotiationCommentView[] }> }> | ActionFail
> {
  if (!UUID_RE.test(auditId)) return { ok: false, error: "Invalid deal." }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: rounds } = await supabase
    .from("negotiation_rounds")
    .select("id, round_no, stance, status, proposer_kind, agreed_version_id, created_at")
    .eq("user_id", user.id)
    .eq("audit_id", auditId)
    .order("round_no", { ascending: false })
    .limit(20)
  const roundRows = (rounds ?? []) as Array<{
    id: string; round_no: number; stance: string; status: string; proposer_kind: string;
    agreed_version_id: string | null; created_at: string
  }>
  if (roundRows.length === 0) return { ok: true, rounds: [] }
  const ids = roundRows.map((r) => r.id)
  const { data: positions } = await supabase
    .from("round_clause_positions")
    .select("round_id, clause_id, outcome, variant, rung, reasoning, counter_text")
    .in("round_id", ids)
    .limit(500)
  const { data: comments } = await supabase
    .from("negotiation_comments")
    .select("id, round_id, channel, body, resolved_at, author_label, created_at")
    .eq("user_id", user.id)
    .eq("audit_id", auditId)
    .order("created_at", { ascending: true })
    .limit(200)
  const posByRound = new Map<string, RoundPositionView[]>()
  for (const p of ((positions ?? []) as Array<{
    round_id: string; clause_id: string; outcome: string; variant: string | null;
    rung: number | null; reasoning: string; counter_text: string
  }>)) {
    if (p.outcome !== "accept" && p.outcome !== "fallback" && p.outcome !== "escalate" && p.outcome !== "route") continue
    const list = posByRound.get(p.round_id) ?? []
    list.push({
      clauseId: p.clause_id,
      outcome: p.outcome,
      variant: (p.variant === "preferred" || p.variant === "fallback" || p.variant === "walkaway") ? p.variant : null,
      rung: typeof p.rung === "number" ? p.rung : null,
      reasoning: p.reasoning,
      counterText: p.counter_text,
    })
    posByRound.set(p.round_id, list)
  }
  const commentsByRound = new Map<string, NegotiationCommentView[]>()
  for (const c of ((comments ?? []) as Array<{
    id: string; round_id: string | null; channel: string; body: string;
    resolved_at: string | null; author_label: string | null; created_at: string
  }>)) {
    if (c.channel !== "internal" && c.channel !== "external") continue
    const key = c.round_id ?? "deal"
    const list = commentsByRound.get(key) ?? []
    list.push({
      id: c.id,
      channel: c.channel,
      body: c.body,
      resolved: c.resolved_at !== null,
      authorLabel: c.author_label ?? "",
      createdAt: c.created_at,
    })
    commentsByRound.set(key, list)
  }
  return {
    ok: true,
    rounds: roundRows.map((r) => ({
      id: r.id,
      roundNo: r.round_no,
      stance: r.stance === "light" || r.stance === "balanced" || r.stance === "firm" ? r.stance : "balanced",
      status: r.status,
      proposerKind: r.proposer_kind,
      agreedVersionId: r.agreed_version_id,
      createdAt: r.created_at,
      positions: posByRound.get(r.id) ?? [],
      comments: [...(commentsByRound.get(r.id) ?? []), ...(commentsByRound.get("deal") ?? [])],
    })),
  }
}

/** Owner resolves or reopens a comment thread. External resolution unblocks round acceptance. */
export async function resolveNegotiationComment(input: {
  commentId: string
  resolved: boolean
}): Promise<ActionOk<{ resolved: boolean }> | ActionFail> {
  if (!UUID_RE.test(input.commentId)) return { ok: false, error: "That comment no longer exists." }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { error } = await supabase
    .from("negotiation_comments")
    .update({ resolved_at: input.resolved ? new Date().toISOString() : null })
    .eq("id", input.commentId)
    .eq("user_id", user.id)
  if (error) return { ok: false, error: "We couldn't update that thread. Please try again." }
  return { ok: true, resolved: input.resolved }
}

/** Owner posts on either channel. Guests read external only, via token RPCs. */
export async function postNegotiationComment(input: {
  auditId: string
  roundId?: string | null
  channel: "internal" | "external"
  body: string
}): Promise<ActionOk<{ comment: NegotiationCommentView }> | ActionFail> {
  if (!UUID_RE.test(input.auditId)) return { ok: false, error: "Invalid deal." }
  if (input.channel !== "internal" && input.channel !== "external") {
    return { ok: false, error: "Unknown channel." }
  }
  const body = (input.body ?? "").trim().slice(0, 2000)
  if (!body) return { ok: false, error: "Write the comment first." }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: audit } = await supabase
    .from("audits")
    .select("id")
    .eq("id", input.auditId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!audit) return { ok: false, error: "Deal not found." }
  let roundId: string | null = null
  if (input.roundId) {
    if (!UUID_RE.test(input.roundId)) return { ok: false, error: "Invalid round." }
    const { data: round } = await supabase
      .from("negotiation_rounds")
      .select("id")
      .eq("id", input.roundId)
      .eq("user_id", user.id)
      .eq("audit_id", input.auditId)
      .maybeSingle()
    if (!round) return { ok: false, error: "Round not found." }
    roundId = (round as { id: string }).id
  }
  const { data, error } = await supabase
    .from("negotiation_comments")
    .insert({ user_id: user.id, audit_id: input.auditId, round_id: roundId, channel: input.channel, body })
    .select("id, channel, body, created_at")
    .single()
  if (error || !data) return { ok: false, error: "We couldn't post that comment. Please try again." }
  const row = data as { id: string; channel: string; body: string; created_at: string }
  return {
    ok: true,
    comment: {
      id: row.id,
      channel: row.channel === "external" ? "external" : "internal",
      body: row.body,
      resolved: false,
      authorLabel: "",
      createdAt: row.created_at,
    },
  }
}
