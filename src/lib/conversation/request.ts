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
import { authorizeOperation, completeOperation, type Authorization } from "@/lib/credits/policy"
import type { LedgerClient } from "@/lib/credits/ledger"

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

const has = (text: string, pattern: RegExp): boolean => pattern.test(text)

// Pure social greetings get a deterministic reply: no AI call, no ledger
// interaction, no charge. Anything beyond a greeting flows through the full
// pipeline. Narrow by construction (short greeting only).
export function isGreeting(text: string): boolean {
  const t = text.toLowerCase().trim()
  return /^(hi|hey|hello|yo|thanks|thank you|ok|okay|bye)\b/.test(t) && t.length < 30
}

export const DETERMINISTIC_GREETING = "Hello. What are you working on?"

// Keyword heuristic for operation routing. Transparent and bounded: it picks
// the execution policy (budget, context selection, document requirement),
// never a conclusion.
export function classifyOperation(text: string, hasDocument: boolean): AIOperation {
  if (isGreeting(text)) return "conversation"
  const t = text.toLowerCase().trim()
  if (/negotiat|push back|counter(-|\s*)offer|ask for more|lower the|raise the|how should i respond|how to respond/.test(t)) return "negotiation"
  if (/compar|which (one|offer)|better deal|better offer|two offers/.test(t)) return "comparison"
  if (/\b(draft|write|word|respond|reply|email|letter|redline|suggest (a |the )?clause|safer version)\b/.test(t)) return "drafting"
  if (/should i (accept|sign|agree|take|walk away)|worth it|good deal|bad deal|decide|make sense for me/.test(t)) return "decision_support"
  if (/what does|what is|what do you mean|explain|mean by|define|net 30|how does .* work/.test(t)) return "explanation"
  if (/review|analy[sz]e|biggest problem|risk|audit|look (at|over)|check this|problem/.test(t)) {
    return "document_analysis"
  }
  void hasDocument
  return "conversation"
}

export function inferIntent(text: string, operation: AIOperation): UserIntent {
  const t = text.toLowerCase()
  if (operation === "negotiation") return "negotiate"
  if (operation === "drafting") return "draft"
  if (operation === "comparison") return "compare"
  if (operation === "decision_support") return "decide"
  if (operation === "document_analysis") return "review"
  if (operation === "explanation" || has(t, /what does|what is|explain|mean by/)) return "understand"
  if (has(t, /should i|decide|worth it/)) return "decide"
  if (has(t, /negotiat/)) return "negotiate"
  return "explore"
}

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
  const text = request.text.trim()
  if (!text) throw new Error("A question is required")
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
        if (loadedFacts) {
          facts = {
            ...facts,
            [vertical.key]: JSON.parse(JSON.stringify(vertical.deriveFacts(loadedFacts.extracted, loadedFacts.rawText))) as unknown,
          }
        }
      }
      const scopedKnowledge = vertical ? vertical.selectCandidates(knowledge) : knowledge
      const run = evaluateApplicableRules(
        {
          context: envelope,
          facts,
          knowledge: scopedKnowledge,
          operation,
          intent,
          objective: request.objective,
          evaluatedAt: new Date().toISOString(),
        },
        operation,
        dealType
      )
      allFindings = selectRelevantFindings(run.results, { operation, intent, objective: request.objective, limit: 50 })
    } catch {
      allFindings = []
    }
  }
  const findingsUsed = selectFindingsForIntent(allFindings, intent, findingLimitFor(operation))
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

  const history = truncateHistory(request.history)
  const taskPrompt = [
    `User question: ${text}`,
    `Operation: ${operation}. Intent: ${intent}.${request.objective ? ` User objective: ${request.objective}.` : ""}`,
    `Deal context: ${summarizeContext(envelope)}`,
    findingsUsed.length > 0
      ? `Deterministic findings to reason over (explain and prioritize these; do not change their status):\n${findingsUsed.map((f) => `- [${f.severity}] ${f.summary}${f.guidance ? ` Next step: ${f.guidance}` : ""}`).join("\n")}`
      : "No deterministic findings available; answer from the question and context, and say what information is missing if that limits the answer.",
    history.length > 0
      ? `Recent conversation:\n${history.map((h) => `${h.role}: ${h.text}`).join("\n")}`
      : "No prior conversation in this thread.",
    "Answer the user's question directly and concisely.",
  ].join("\n\n")

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
