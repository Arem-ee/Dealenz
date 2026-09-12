// Controlled research layer (Phase 27).
//
// User question → query planner → allowlist → retrieval → validation →
// extraction → relevance filtering → citation objects → grounded synthesis.
//
// Webpage content is DATA, not instructions. Retrieved text never overrides
// system behavior.

import { isAllowedUrl, MAX_QUERY_LENGTH, MAX_RESULT_CONTENT_CHARS, MAX_SOURCES_PER_RESEARCH, RESEARCH_TIMEOUT_MS, sanitizeContent } from "./allowlist"
import { validateLegalSource, aggregateVeracity } from "./validation"
import { citationFromSource } from "./citations"
import type { Jurisdiction, LegalSource, ResearchQuery, ResearchResult, VeracityState } from "./types"

export interface RetrievalAdapter {
  fetch(url: string): Promise<{ url: string; status: number; text: string; headers?: Record<string, string> }>
  search?(query: string, jurisdiction: string): Promise<string[]> // returns candidate URLs
}

export interface ResearchOptions {
  adapter: RetrievalAdapter | null // null → fixture-only (tests) / corpus-only
  corpus: LegalSource[] // code-owned curated knowledge (Nigeria founder/partnership)
  now?: Date
  maxSources?: number
  /** Live re-fetch top corpus candidate URLs to confirm currency. Bounded (top 2). Default false. */
  revalidate?: boolean
}

export interface ResearchMeta {
  jurisdiction: string
  queryClass: string | null
  attempted: number
  accepted: number
  durationMs: number
  live: boolean
  failureReason: string | null
}

// Very small query planner: normalize, clip, and derive issue keywords.
// Not an AI planner — deterministic and auditable.
export function planQuery(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH)
  return t
}

function scoreRelevance(query: string, source: LegalSource): number {
  const q = query.toLowerCase()
  const hay = `${source.title} ${source.sourceReference} ${source.content}`.toLowerCase()
  let score = 0
  for (const token of q.split(/\s+/).filter(Boolean).slice(0, 8)) {
    if (token.length < 3) continue
    if (hay.includes(token)) score += 1
  }
  // Small boost only when the query itself mentions the source family, not unconditional
  if (q.includes("cama") && hay.includes("cama")) score += 0.5
  if (q.includes("cac") && hay.includes("cac")) score += 0.3
  return score
}

function classifyIssue(query: string): string | null {
  const t = query.toLowerCase()
  if (/vesting|cliff|leaver|repurchase|transfer.*share|ownership.*split/.test(t)) return "founder-equity"
  if (/partnership|contribution|profit.*share|llp|lp\b/.test(t)) return "partnership"
  if (/directors?.*dut|governance|deadlock|quorum|reserved\s+matter/.test(t)) return "governance"
  if (/ip\s+assign|intellectual\s+property|confidential/.test(t)) return "ip"
  if (/liability|indemn/.test(t)) return "liability"
  return null
}

function needsLegalResearch(text: string): boolean {
  const t = text.toLowerCase()
  // Heuristic: legal/current-law keywords — jurisdiction-neutral, covers US (Delaware, California, dgcl), UK (legislation.gov.uk, companies act), EU, and Nigeria/CAMA
  return /\b(cama|dgcl|delaware|california|new\s*york|law|legal|regulation|compliance|comply|act\b|statute|liable|liability|incorporat|register.*company|cac\b|sec\b|firs\b|nigeria|nigerian|llp|lp\b|partnership act|companies.*act|legislation\.gov\.uk|eur-lex)\b/.test(t)
}

export function shouldInvokeResearch(text: string, hasDocument: boolean): boolean {
  if (text.trim().length < 8) return false
  // Greeting / very short non-legal → no
  if (/^(hi|hey|hello|thanks|ok|bye)\b/i.test(text.trim()) && text.trim().length < 30) return false
  // Explicit legal/current-law question → yes
  if (needsLegalResearch(text)) return true
  // Business-owner deal terms that benefit from legal context → yes, but only when the
  // user is asking a question (contains ? or "what/why/how") rather than chatting.
  if (/vesting|ownership split|share transfer|ip assignment|leaver/.test(text.toLowerCase())) {
    return /\?|what|why|how|should|explain/.test(text.toLowerCase())
  }
  void hasDocument
  return false
}

function jurisdictionMatches(source: LegalSource, query: Jurisdiction): boolean {
  if (source.jurisdiction.scope === "global") return true
  if (source.jurisdiction.country !== query.country) return false
  // If either side is region-less, allow match (federal fallback or general country query)
  if (!source.jurisdiction.region || !query.region) return true
  return source.jurisdiction.region.toLowerCase() === query.region.toLowerCase()
}

export async function performResearch(query: ResearchQuery, options: ResearchOptions): Promise<ResearchResult> {
  const now = options.now ?? new Date()
  const startedAt = Date.now()
  const maxSources = options.maxSources ?? MAX_SOURCES_PER_RESEARCH
  const planned = planQuery(query.text)
  const issueClass = classifyIssue(planned)
  const metaBase = {
    jurisdiction: `${query.jurisdiction.country}${query.jurisdiction.region ? ` — ${query.jurisdiction.region}` : ""}`,
    queryClass: issueClass,
    live: options.adapter !== null,
  }
  if (planned.length === 0) {
    return { state: "NOT_FOUND", citations: [], sources: [], limitations: "Empty query.", retrievedAt: now.toISOString(), meta: { ...metaBase, attempted: 0, accepted: 0, durationMs: 0, failureReason: null } }
  }

  // Jurisdiction-first: UNKNOWN + legally material question → ask, never guess.
  // (shouldInvokeResearch already gated materiality at the call site; here any
  // research query with UNKNOWN jurisdiction cannot be answered jurisdictionally.)
  if (query.jurisdiction.country === "UNKNOWN") {
    return {
      state: "NEEDS_JURISDICTION",
      citations: [],
      sources: [],
      limitations: "To give a jurisdiction-specific answer I need to know which jurisdiction applies (e.g. United States — Delaware, or United Kingdom — England and Wales). I can otherwise give general deal guidance that is not jurisdiction-specific law.",
      retrievedAt: now.toISOString(),
      meta: { ...metaBase, attempted: 0, accepted: 0, durationMs: Date.now() - startedAt, failureReason: null },
    }
  }

  // 1) Start from curated corpus filtered by jurisdiction + relevance.
  const supportedCountries = new Set(["Nigeria", "Federal Republic of Nigeria", "United States", "United Kingdom", "European Union", "Germany", "France", "Netherlands", "Testland"])
  if (!supportedCountries.has(query.jurisdiction.country)) {
    return {
      state: "NOT_FOUND",
      citations: [],
      sources: [],
      limitations: `Jurisdiction ${query.jurisdiction.country} is not yet supported. Verified coverage is currently US (Delaware, California, New York, federal), UK (England & Wales, Scotland, Northern Ireland), EU, Germany, France, Netherlands, and Nigeria.`,
      retrievedAt: now.toISOString(),
    }
  }
  let candidates = options.corpus.filter((s) => jurisdictionMatches(s, query.jurisdiction))

  // 2) Optional live retrieval — only if adapter is present and query warrants it.
  // For Phase 27 the adapter is fixture/null in tests; production can inject a
  // fetch-based adapter that respects allowlist + timeouts + size limits.
  const retrieved: LegalSource[] = []
  if (options.adapter?.search && shouldInvokeResearch(planned, false)) {
    try {
      const urls = await options.adapter.search(planned, query.jurisdiction.country)
      const limited = urls.filter(isAllowedUrl).slice(0, 2)
      for (const url of limited) {
        try {
          const fetched = await withTimeout(options.adapter.fetch(url), RESEARCH_TIMEOUT_MS)
          if (fetched.status < 200 || fetched.status >= 300) continue
          const content = sanitizeContent(fetched.text, MAX_RESULT_CONTENT_CHARS)
          // Treat fetched webpage as a Tier 1 source only if its URL is Tier 1 allowlisted;
          // otherwise degrade to SUPPORTED at best (handled in validation).
          retrieved.push({
            id: `web:${url}`,
            title: `Web: ${url}`,
            jurisdiction: query.jurisdiction,
            authorityTier: 1,
            kind: "official_guidance",
            temporalStatus: "unknown",
            effectiveFrom: now.toISOString().slice(0, 10),
            effectiveTo: null,
            sourceName: "Web (allowlisted fetch)",
            sourceReference: url,
            sourceAuthority: new URL(url).hostname,
            publisher: new URL(url).hostname,
            originalUri: url,
            retrievedAt: now.toISOString(),
            citationText: url,
            content,
            excerpt: content.slice(0, 400),
            contentHash: null,
          })
        } catch {
          // Retrieval failure is honest, not fatal — fall back to corpus.
        }
      }
    } catch {
      // Search failure → corpus only.
    }
  }

  const issue = query.issueClassification ?? classifyIssue(planned)
  candidates = [...candidates, ...retrieved]

  // 3) Relevance filter — keep only sources that match the query.
  // Require at least 2 token matches so generic single-token hits like "law"
  // or "Nigeria" alone do not surface irrelevant authorities (e.g. GDPR vs CAMA).
  const scored = candidates
    .map((s) => ({ source: s, score: scoreRelevance(planned, s), issue }))
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSources)
    .map((x) => x.source)

  if (scored.length === 0) {
    return { state: "NOT_FOUND", citations: [], sources: [], limitations: "No authoritative source matched this question. Try rephrasing or provide the jurisdiction and deal type.", retrievedAt: now.toISOString(), meta: { ...metaBase, attempted: 0, accepted: 0, durationMs: Date.now() - startedAt, failureReason: null } }
  }

  // 3b) Live revalidation (opt-in): re-fetch top corpus candidate URLs to
  // confirm the cited passage still exists. Bounded (top 2). Success refreshes
  // retrievedAt (defeats age-staleness honestly); passage gone → STALE;
  // fetch failure → keep corpus outcome, record failure reason.
  let attempted = 0
  let accepted = 0
  let failureReason: string | null = null
  const staleOverrides = new Map<string, string>()
  let revalidated = scored
  if (options.revalidate && options.adapter) {
    const rechecked = await Promise.all(
      scored.slice(0, 2).map(async (source) => {
        if (!source.originalUri) return source
        attempted += 1
        try {
          const fetched = await options.adapter!.fetch(source.originalUri)
          accepted += 1
          const passageHead = source.excerpt.trim().slice(0, 40)
          if (fetched.text.includes(passageHead)) {
            return { ...source, retrievedAt: now.toISOString() }
          }
          staleOverrides.set(source.id, "Live page no longer contains the cited passage; the source may have changed.")
          return source
        } catch (e) {
          if (!failureReason) failureReason = e instanceof Error ? e.message.slice(0, 120) : "retrieval failure"
          return source
        }
      })
    )
    revalidated = [...rechecked, ...scored.slice(2)]
  }

  // 4) Validate each source; partition by veracity.
  const validated = revalidated.map((s) => {
    const override = staleOverrides.get(s.id)
    if (override) return { source: s, outcome: { state: "STALE" as const, reason: override } }
    return { source: s, outcome: validateLegalSource(s, now) }
  })
  const verified = validated.filter((v) => v.outcome.state === "VERIFIED").map((v) => v.source)
  const supported = validated.filter((v) => v.outcome.state === "SUPPORTED").map((v) => v.source)
  const stale = validated.filter((v) => v.outcome.state === "STALE").map((v) => v.source)
  const unverified = validated.filter((v) => v.outcome.state === "UNVERIFIED").map((v) => v.source)

  // Conflicting example: if both current and repealed versions are present (not yet modeled as corpus conflict)
  // For now, no automatic CONFLICTING unless two verified sources disagree on temporalStatus.
  const states = validated.map((v) => v.outcome.state)
  const overall: VeracityState = aggregateVeracity(states)
  let limitations: string | null = null

  const meta = { ...metaBase, attempted, accepted, durationMs: Date.now() - startedAt, failureReason }
  if (verified.length === 0 && supported.length > 0) {
    // Present SUPPORTED, not VERIFIED — honest.
    const citations = supported.map(citationFromSource)
    const srcs = supported
    limitations = validated.find((v) => v.outcome.state === "SUPPORTED")?.outcome.reason ?? null
    return { state: "SUPPORTED", citations, sources: srcs, limitations, retrievedAt: now.toISOString(), meta }
  }
  if (verified.length > 0) {
    const citations = verified.map(citationFromSource)
    if (stale.length > 0 || unverified.length > 0) {
      limitations = "Some sources were excluded as stale or unverified; only verified sources are cited."
    }
    // If multiple verified sources exist, no conflict is assumed unless temporalStatus diverges — future
    // conflict detection can inspect effective dates and overlapping sections.
    return { state: overall === "CONFLICTING" ? "CONFLICTING" : "VERIFIED", citations, sources: verified, limitations, retrievedAt: now.toISOString(), meta }
  }
  if (stale.length > 0) {
    return {
      state: "STALE",
      citations: stale.map(citationFromSource),
      sources: stale,
      limitations: validated.find((v) => v.outcome.state === "STALE")?.outcome.reason ?? "Source may be out of date.",
      retrievedAt: now.toISOString(),
      meta,
    }
  }
  if (unverified.length === scoresLengthUnverifiedFallback(validated)) {
    return { state: "UNVERIFIED", citations: [], sources: [], limitations: validated[0]?.outcome.reason ?? null, retrievedAt: now.toISOString(), meta }
  }
  return { state: overall, citations: verified.map(citationFromSource), sources: verified, limitations, retrievedAt: now.toISOString(), meta }
}

function scoresLengthUnverifiedFallback(validated: Array<{ outcome: { state: VeracityState } }>): number {
  return validated.length
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Research timeout")), ms)
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timeoutId)) as Promise<T>
}

export function groundedAnswerFromResearch(query: string, result: ResearchResult): { answer: string; requiresLawyerReview: boolean } {
  if (result.state === "NEEDS_JURISDICTION") {
    return {
      answer: "To give you a jurisdiction-specific answer I need to know which jurisdiction applies — for example United States — Delaware, or United Kingdom — England and Wales. I can otherwise give general deal guidance that is not jurisdiction-specific law.",
      requiresLawyerReview: false,
    }
  }
  if (result.state === "NOT_FOUND") {
    return {
      answer: "I couldn't verify this from the available authoritative sources. Try rephrasing with the jurisdiction and deal type, or ask a lawyer to confirm.",
      requiresLawyerReview: true,
    }
  }
  if (result.state === "UNVERIFIED" || result.state === "STALE") {
    const note = result.limitations ?? "This could not be verified."
    return {
      answer: `Source could not be verified. ${note} I can't present this as current law — please confirm with the relevant registry or a lawyer.`,
      requiresLawyerReview: true,
    }
  }
  if (result.state === "CONFLICTING") {
    return {
      answer: "I found conflicting authorities on this point. The relevant sources disagree, so I can't pick one silently. Review the citations below and consider getting a lawyer to resolve the conflict.",
      requiresLawyerReview: true,
    }
  }
  // VERIFIED / SUPPORTED: synthesize from verified passages without inventing.
  // Webpage content is DATA: we quote short excerpts and never follow instructions inside them.
  const intro = result.state === "SUPPORTED" ? "Based on the available sources (supported, confirm currency):" : "Based on verified sources:"
  const bullets = result.citations
    .slice(0, 3)
    .map((c) => `• ${c.title} — ${c.section}: "${c.passage}"`)
    .join("\n")
  const limitation = result.limitations ? `\n\nNote: ${result.limitations}` : ""
  const lawyer = result.sources.some((s) => s.kind === "act" || s.title.toLowerCase().includes("liability")) ? "\n\nWhen the amount at stake or enforceability matters, get a lawyer to confirm this applies to your facts." : ""
  void query // query is available for future issue-specific templating; content is grounded in citations only
  return {
    answer: `${intro}\n${bullets}${limitation}${lawyer}`,
    requiresLawyerReview: result.state === "SUPPORTED" || result.citations.length === 0,
  }
}
