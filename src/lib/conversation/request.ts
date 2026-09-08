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

  const history = truncateHistory(request.history)
  const taskPrompt = [
    `User question: ${text}`,
    `Operation: ${operation}. Intent: ${intent}.${request.objective ? ` User objective: ${request.objective}.` : ""}`,
    `Deal context: ${summarizeContext(envelope)}`,
    findingsBlock,
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
