// Conversational request pipeline (Phase 5E backend architecture).
//
// Lets a user ask a useful question with or without a document:
//   question → operation → context → knowledge → rules → synthesis →
//   usage measurement → credit accounting.
//
// No chat UI lives here (that comes later); this is the backend boundary a
// future UI calls. Stateless per turn: optional caller-provided history is
// truncated, never summarized or stored. Operation and intent detection are
// documented keyword heuristics, not a classifier. Deterministic truth never
// depends on credits, intent, or objective (asserted in tests).

import { applyConstitution, validateOutputContract } from "@/lib/ai/constitution"
import {
  maxTokensForOperation,
  resolveOperationProfile,
  type AIOperation,
  type UserIntent,
  type UserObjective,
} from "@/lib/ai/operations"
import { classifyOperation, DETERMINISTIC_GREETING, inferIntent, isGreeting } from "./classify"
import type { AIUsageRecord, CreditPolicy, TokenUsage } from "@/lib/ai/usage"
import type { ContextEnvelope } from "@/lib/context/schema"
import type { ExtractedData } from "@/lib/ai/extract"
import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"
import {
  evaluateApplicableRules,
  registerBuiltinRules,
  selectRelevantFindings,
  type Finding,
} from "@/lib/rules"
import { verticalForDealType } from "@/lib/verticals"
import { attachEvidence } from "@/lib/evidence"
import { authorizeOperation, completeOperation, type Authorization } from "@/lib/credits/policy"
import type { LedgerClient } from "@/lib/credits/ledger"
import { shouldInvokeResearch, performResearch, groundedAnswerFromResearch } from "@/lib/legal-research/research"
import { getResearchAdapter } from "@/lib/legal-research/retrieval"
import { INTERNATIONAL_LEGAL_CORPUS } from "@/lib/legal-research/corpus"
import type { Jurisdiction, LegalCitation, ResearchResult } from "@/lib/legal-research/types"

export interface HistoryTurn {
  role: "user" | "assistant"
  text: string
}

export interface ConversationPorts {
  loadContext(auditId: string): Promise<ContextEnvelope | null>
  loadFacts(auditId: string): Promise<{ extracted: ExtractedData; rawText: string } | null>
  loadKnowledge(envelope: ContextEnvelope | null): Promise<KnowledgeCandidate[]>
  aiCaller(request: {
    systemPrompt: string
    userContent: string
    maxTokens: number
  }): Promise<{ text: string; usage?: TokenUsage; provider: string; model: string }>
  ledger: LedgerClient
  policy: CreditPolicy | null
}

export interface ConversationRequest {
  text: string
  auditId?: string
  userId: string
  objective?: UserObjective
  history?: HistoryTurn[]
  idempotencyKey?: string
  ports: ConversationPorts
}

export interface KnowledgeSource {
  itemKey: string
  title: string
  authority: KnowledgeCandidate["authority"]
  sourceName: string
  sourceReference: string
  jurisdiction: string
  effectiveFrom: string
}

export type ConversationResponse =
  | {
      type: "answer"
      text: string
      operation: AIOperation
      intent: UserIntent
      findingsUsed: Finding[]
      knowledgeSources: KnowledgeSource[]
      legalCitations: LegalCitation[]
      researchState: ResearchResult["state"] | null
      legalLimitations: string | null
      requiresLawyerReview: boolean
      // True only for the deterministic greeting fast-path: no AI call, no
      // ledger interaction, no computation to charge.
      deterministic: boolean
      usageRecord: AIUsageRecord | null
      creditsConsumed: number | null
      balance: number | null
      contractViolations: string[]
    }
  | { type: "needs_document"; operation: AIOperation; intent: UserIntent; message: string }
  | { type: "denied"; operation: AIOperation; intent: UserIntent; denialReason: string; balance: number | null }

export { classifyOperation, DETERMINISTIC_GREETING, inferIntent, isGreeting } from "./classify"

// Intent shapes relevance and presentation only. Decision-relevant questions
// surface material findings first; negotiation surfaces actionable ones;
// explanation takes the top relevant set. Truth is untouched: selection
// filters and orders, never edits statuses or summaries.
export function selectFindingsForIntent(
  findings: Finding[],
  intent: UserIntent,
  limit: number
): Finding[] {
  const order = { critical: 3, material: 2, attention: 1, informational: 0 } as const
  const sorted = [...findings].sort(
    (a, b) => order[b.severity] - order[a.severity] || a.ruleKey.localeCompare(b.ruleKey)
  )
  if (intent === "decide") {
    const material = sorted.filter((f) => f.severity === "critical" || f.severity === "material")
    return [...material, ...sorted.filter((f) => f.severity !== "critical" && f.severity !== "material")].slice(0, limit)
  }
  if (intent === "negotiate") {
    const actionable = sorted.filter((f) => f.guidance && f.guidance.trim().length > 0)
    return [...actionable, ...sorted.filter((f) => !f.guidance || f.guidance.trim().length === 0)].slice(0, limit)
  }
  return sorted.slice(0, limit)
}

function findingLimitFor(operation: AIOperation): number {
  const budget = resolveOperationProfile(operation).outputBudget
  if (budget === "brief") return 3
  if (budget === "standard") return 6
  return 10
}

function summarizeContext(envelope: ContextEnvelope | null): string {
  if (!envelope) return "No resolved deal context."
  const pick = (key: "dealType" | "jurisdiction" | "userRole" | "counterpartyRole" | "industry") => {
    const field = envelope.fields[key]
    if (field.source === "unknown" || field.value === null) return null
    return `${key}: ${field.value} (${field.source === "user_confirmed" ? "confirmed" : "inferred"})`
  }
  const parts = (["dealType", "jurisdiction", "userRole", "counterpartyRole", "industry"] as const)
    .map(pick)
    .filter((p): p is string => p !== null)
  return parts.length > 0 ? parts.join("; ") : "Deal context unresolved."
}

function truncateHistory(history: HistoryTurn[] | undefined): HistoryTurn[] {
  if (!history || history.length === 0) return []
  return history.slice(-6).map((turn) => ({
    role: turn.role,
    text: turn.text.slice(0, 1000),
  }))
}

export async function answerQuestion(request: ConversationRequest): Promise<ConversationResponse> {
  const rawText = request.text.trim()
  if (!rawText) throw new Error("A question is required")
  // Very long questions are truncated for the model prompt (history is
  // already bounded separately). Stored messages keep up to 8000 chars
  // (store.ts), the prompt keeps 4000, so no single turn can dominate.
  const text = rawText.slice(0, 4000)
  const hasDocument = Boolean(request.auditId)
  const operation = classifyOperation(text, hasDocument)
  const profile = resolveOperationProfile(operation)
  const intent = inferIntent(text, operation)

  // Deterministic greeting: a social hello is answered without computation.
  // No provider call, no ledger interaction, no charge, no findings lookup.
  if (isGreeting(text)) {
    return {
      type: "answer",
      text: DETERMINISTIC_GREETING,
      operation,
      intent,
      findingsUsed: [],
      knowledgeSources: [],
      legalCitations: [],
      researchState: null,
      legalLimitations: null,
      requiresLawyerReview: false,
      deterministic: true,
      usageRecord: null,
      creditsConsumed: null,
      balance: null,
      contractViolations: [],
    }
  }

  if (profile.requiresDocument && !hasDocument) {
    return {
      type: "needs_document",
      operation,
      intent,
      message: "To review a specific agreement I need the document or deal text. Upload it or paste it, then ask again. If you have a general question, ask it directly without requesting a review.",
    }
  }

  const authorization: Authorization = await authorizeOperation({
    ledger: request.ports.ledger,
    userId: request.userId,
    operation,
    idempotencyKey: request.idempotencyKey,
    policy: request.ports.policy,
  })
  if (!authorization.authorized) {
    return {
      type: "denied",
      operation,
      intent,
      denialReason: authorization.denialReason ?? "Not authorized",
      balance: authorization.balance,
    }
  }

  registerBuiltinRules()

  let envelope: ContextEnvelope | null = null
  let facts: Record<string, unknown> = {}
  let loadedFacts: { extracted: ExtractedData; rawText: string } | null = null
  let knowledge: KnowledgeCandidate[] = []
  if (request.auditId) {
    try {
      envelope = await request.ports.loadContext(request.auditId)
    } catch {
      envelope = null
    }
    try {
      const loaded = await request.ports.loadFacts(request.auditId)
      if (loaded) {
        loadedFacts = loaded
        facts = {
          budget: loaded.extracted.budget,
          timeline: loaded.extracted.timeline,
          deliverables: loaded.extracted.deliverables,
          projectType: loaded.extracted.projectType,
          confidence: loaded.extracted.confidence,
        }
      }
    } catch {
      facts = {}
    }
    try {
      knowledge = envelope ? await request.ports.loadKnowledge(envelope) : []
    } catch {
      knowledge = []
    }
  }

  // Unknown deal type stays unknown: freelance-scoped rules must not run on
  // deals of unestablished type. Unscoped generic rules still evaluate.
  const dealType =
    envelope && envelope.fields.dealType.source !== "unknown" && envelope.fields.dealType.value
      ? envelope.fields.dealType.value
      : "unknown"
  let allFindings: Finding[] = []
  if (request.auditId && envelope) {
    try {
      // The vertical is the variable: resolve this deal's pack (if any),
      // register it, project its facts, and scope its knowledge. Shared
      // layers never import a vertical directly.
      const vertical = verticalForDealType(dealType)
      if (vertical) {
        vertical.registerPack()
        if (loadedFacts && request.auditId) {
          facts = {
            ...facts,
            [vertical.key]: JSON.parse(
              JSON.stringify(
                vertical.deriveFacts(loadedFacts.extracted, loadedFacts.rawText, {
                  type: "audit_input",
                  id: request.auditId,
                })
              )
            ) as unknown,
          }
        }
      }
      const scopedKnowledge = vertical ? vertical.selectCandidates(knowledge) : knowledge
      const rulesInput = {
        context: envelope,
        facts,
        knowledge: scopedKnowledge,
        operation,
        intent,
        objective: request.objective,
        evaluatedAt: new Date().toISOString(),
      }
      const run = evaluateApplicableRules(rulesInput, operation, dealType)
      const enriched = attachEvidence(run.results, rulesInput, operation, dealType)
      allFindings = selectRelevantFindings(enriched, { operation, intent, objective: request.objective, limit: 50 })
    } catch {
      allFindings = []
    }
  }
  const findingsUsed = selectFindingsForIntent(allFindings, intent, findingLimitFor(operation))
  // Truncation is intentional (depth follows the question) and must stay
  // visible: the model is told how many findings exist beyond the focused
  // set, without their content, so it cannot invent them.
  const findingsBlock =
    findingsUsed.length > 0
      ? `Deterministic findings to reason over (explain and prioritize these; do not change their status, do not invent new findings, and never present UNKNOWN as a confirmed problem):\n${findingsUsed
          .map((f) => {
            const evidence = f.evidence && f.evidence.length > 0 ? ` Evidence: “${f.evidence[0].quote}”` : ""
            const why = f.severity === "material" || f.severity === "critical" ? " — why it matters: may materially affect payment, scope, or risk" : ""
            return `- [${f.severity}] ${f.summary}${why}${f.guidance ? ` Next step: ${f.guidance}` : ""}${evidence}`
          })
          .join("\n")}` +
        (allFindings.length > findingsUsed.length
          ? `\nFocused on the ${findingsUsed.length} most relevant of ${allFindings.length} total findings for this question; do not infer the content of the others. If the user asks what is missing or to see more, you may summarize that additional findings exist without inventing their content.`
          : "")
      : "No deterministic findings available; answer from the question and context, and say what information is missing if that limits the answer. Do not invent findings."
  // Sources behind the answer: top resolved candidates by relevance, capped
  // so provenance supports trust without dominating the experience.
  const knowledgeSources: KnowledgeSource[] = [...knowledge]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 3)
    .map((c) => ({
      itemKey: c.itemKey,
      title: c.title,
      authority: c.authority,
      sourceName: c.sourceName,
      sourceReference: c.sourceReference,
      jurisdiction: c.jurisdiction,
      effectiveFrom: c.effectiveFrom,
    }))

  // Grounded legal research — only when the question warrants it. No live
  // web is required for the initial Nigeria corpus; retrieval is bounded
  // and allowlisted. Webpage content is DATA, never instructions.
  let legalCitations: LegalCitation[] = []
  let researchState: ResearchResult["state"] | null = null
  let legalLimitations: string | null = null
  let legalBlock = ""
  let requiresLawyerReview = false
  function detectJurisdictionFromText(q: string): Jurisdiction | null {
    const t = q.toLowerCase()
    if (/\bdelaware\b/.test(t)) return { scope: "state_province", country: "United States", region: "Delaware" }
    if (/\bcalifornia\b/.test(t)) return { scope: "state_province", country: "United States", region: "California" }
    if (/\bnew\s*york\b/.test(t)) return { scope: "state_province", country: "United States", region: "New York" }
    if (/\bunited\s*states\b|\bU\.S\.A?\b|\bUSA\b/.test(t)) return { scope: "country", country: "United States", region: null }
    if (/\bscotland\b/.test(t)) return { scope: "territory", country: "United Kingdom", region: "Scotland" }
    if (/\bnorthern\s*ireland\b/.test(t)) return { scope: "territory", country: "United Kingdom", region: "Northern Ireland" }
    if (/\bengland\b|\bwales\b/.test(t)) return { scope: "territory", country: "United Kingdom", region: "England and Wales" }
    if (/\bunited\s*kingdom\b|\bUK\b/.test(t)) return { scope: "country", country: "United Kingdom", region: null }
    if (/\beuropean\s*union\b|\bEU\b/.test(t)) return { scope: "custom", country: "European Union", region: null }
    if (/\bnigeria\b/.test(t)) return { scope: "country", country: "Nigeria", region: null }
    if (/\bgermany\b/.test(t)) return { scope: "country", country: "Germany", region: null }
    if (/\bfrance\b/.test(t)) return { scope: "country", country: "France", region: null }
    if (/\bnetherlands\b|\bdutch\b/.test(t)) return { scope: "country", country: "Netherlands", region: null }
    return null
  }
  const jurisdiction: Jurisdiction = (() => {
    // Hierarchy: user-confirmed deal jurisdiction → explicit jurisdiction in deal context → explicit jurisdiction in question → UNKNOWN
    const f = envelope?.fields.jurisdiction
    if (f && f.source !== "unknown" && typeof f.value === "string" && (f.value as string).trim().length > 0) {
      const v = String(f.value).trim()
      // Map common values to proper Jurisdiction objects
      if (v.toLowerCase() === "nigeria") return { scope: "country", country: "Nigeria", region: null }
      if (v.toLowerCase() === "united states" || v === "US") return { scope: "country", country: "United States", region: null }
      if (v.toLowerCase() === "united kingdom" || v === "UK") return { scope: "country", country: "United Kingdom", region: null }
      if (v.toLowerCase().includes("delaware")) return { scope: "state_province", country: "United States", region: "Delaware" }
      if (v.toLowerCase().includes("england")) return { scope: "territory", country: "United Kingdom", region: "England and Wales" }
      return { scope: "country", country: v, region: null }
    }
    const fromText = detectJurisdictionFromText(text)
    if (fromText) return fromText
    return { scope: "custom", country: "UNKNOWN", region: null }
  })()
  if (shouldInvokeResearch(text, hasDocument)) {
    // Jurisdiction is never silently defaulted: UNKNOWN yields NEEDS_JURISDICTION.
    // Live retrieval is env-gated (default corpus-only); research stays within
    // the already-authorized operation cost — no separate research charge.
    const adapter = getResearchAdapter()
    try {
      const researchResult = await performResearch(
        { text, jurisdiction, dealType: dealType !== "unknown" ? dealType : null },
        { adapter, corpus: INTERNATIONAL_LEGAL_CORPUS, revalidate: adapter !== null }
      )
      researchState = researchResult.state
      legalCitations = researchResult.citations
      legalLimitations = researchResult.limitations
      requiresLawyerReview = researchResult.state !== "VERIFIED" && researchResult.state !== "NEEDS_JURISDICTION"
      if (researchResult.state === "NEEDS_JURISDICTION") {
        legalBlock = `Legal research: jurisdiction unknown. ${researchResult.limitations ?? ""} Ask the user to specify the jurisdiction (e.g. United States — Delaware, United Kingdom — England and Wales) to give a jurisdiction-specific answer, or provide clearly general deal guidance that is not jurisdiction-specific law.`
      } else if (researchResult.citations.length > 0) {
        const citeLines = researchResult.citations
          .slice(0, 3)
          .map((c) => `- ${c.title} — ${c.section}: "${c.passage}" [${c.url ?? c.sourceId}, retrieved ${c.retrievedAt.slice(0, 10)}, ${c.effectiveStatus}]`)
          .join("\n")
        const stateNote = researchResult.state === "VERIFIED" ? "verified" : researchResult.state.toLowerCase()
        legalBlock = `Legal sources (${stateNote}):\n${citeLines}${legalLimitations ? `\nLimitation: ${legalLimitations}` : ""}\nGround your answer in these sources. Cite the section/URL. If sources conflict or are stale/unverified, say so honestly instead of inventing law.`
      } else if (researchResult.state !== "NOT_FOUND") {
        legalBlock = `Legal research result: ${researchResult.state}${legalLimitations ? ` — ${legalLimitations}` : ""}. Do not present unverified law as fact. Say the source could not be verified.`
      } else {
        const j = `no authoritative source for ${jurisdiction.country}${jurisdiction.region ? ` — ${jurisdiction.region}` : ""} matched`
        legalBlock = `Legal research: ${j}. Do not invent law. If you can answer from deal context alone, do so; otherwise say you could not verify from available sources for that jurisdiction.`
      }
      // If research explicitly produced a NOT_FOUND grounded phrasing, keep it
      // for later use when the model fails to be honest — but prefer the
      // model's own synthesis when sources exist.
      if (researchResult.state === "NOT_FOUND" || researchResult.state === "UNVERIFIED" || researchResult.state === "STALE") {
        requiresLawyerReview = true
      }
      void groundedAnswerFromResearch
    } catch {
      // Research failure is honest, not fatal — answer from deal context alone.
      legalBlock = ""
      researchState = null
    }
  }

  const history = truncateHistory(request.history)
  const taskPrompt = [
    `User question: ${text}`,
    `Operation: ${operation}. Intent: ${intent}.${request.objective ? ` User objective: ${request.objective}.` : ""}`,
    `Deal context: ${summarizeContext(envelope)}`,
    findingsBlock,
    legalBlock,
    history.length > 0
      ? `Recent conversation:\n${history.map((h) => `${h.role}: ${h.text}`).join("\n")}`
      : "No prior conversation in this thread.",
    "Answer the user's question directly and concisely.",
  ]
    .filter(Boolean)
    .join("\n\n")

  const systemPrompt = applyConstitution(
    "You are Dealenz, a user-first deal intelligence assistant. Answer the user's deal question using the provided context and findings.",
    "conversation"
  )
  const maxTokens = maxTokensForOperation(operation)

  try {
    const answer = await request.ports.aiCaller({ systemPrompt, userContent: taskPrompt, maxTokens })
    const violations: string[] = []
    const check = validateOutputContract(answer.text)
    if (check.hasEmDash) violations.push("em-dash")
    if (check.isEmpty) violations.push("empty")
    const completion = await completeOperation({
      ledger: request.ports.ledger,
      authorization,
      operation,
      provider: answer.provider,
      model: answer.model,
      usage: answer.usage,
      status: "success",
      policy: request.ports.policy,
    })
    return {
      type: "answer",
      text: answer.text,
      operation,
      intent,
      findingsUsed,
      knowledgeSources,
      legalCitations,
      researchState,
      legalLimitations,
      requiresLawyerReview,
      deterministic: false,
      usageRecord: completion.record,
      creditsConsumed: completion.record.creditsConsumed,
      balance: completion.balance,
      contractViolations: violations,
    }
  } catch (err) {
    await completeOperation({
      ledger: request.ports.ledger,
      authorization,
      operation,
      status: err instanceof Error && err.name === "AIProviderError" ? "provider_failure" : "pre_provider_failure",
      policy: request.ports.policy,
    }).catch(() => undefined)
    throw err
  }
}
