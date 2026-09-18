// Authenticated conversation surface (Phases 5G + 10).
//
// Thin bridge between the UI and the conversation request pipeline: verifies
// the session, enforces ownership on attached audits and conversations,
// assembles real ports (RLS-governed reads, authenticated AI surface, ledger
// RPCs, priced policy), and returns only serializable data. The client is
// trusted for nothing: no credits, provider, model, token counts, findings,
// or authority cross the boundary from the browser. Conversations persist
// per-user; every message inherits the pipeline's constitution and bounded
// history (the server truncates, never the client).

"use server"

import { createClient } from "@/lib/supabase/server"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import {
  answerQuestion,
  classifyOperation,
  DETERMINISTIC_GREETING,
  isGreeting,
  type ConversationResponse,
  type HistoryTurn,
} from "@/lib/conversation/request"
import { getCreditBalance, type LedgerClient } from "@/lib/credits/ledger"
import { priceForOperation, STANDARD_CREDIT_POLICY } from "@/lib/credits/pricing"
import { fetchPublishedKnowledge, resolveKnowledge } from "@/lib/knowledge"
import { parseContextEnvelope } from "@/lib/context/schema"
import { callAISurface } from "@/lib/ai/client"
import { AIProviderError } from "@/lib/ai/errors"
import { reportError } from "@/lib/logger"
import { publicErrorMessage } from "@/lib/safe-error"
import {
  addMessage,
  createConversation,
  getConversation,
  listConversations,
  listMessages,
  touchConversation,
  type ConversationRow,
} from "@/lib/conversation/store"
import type { ExtractedData } from "@/lib/ai/extract"

export interface AskInput {
  text: string
  auditId?: string
  conversationId?: string
  history?: HistoryTurn[]
  idempotencyKey?: string
}

export interface ConversationSummary {
  id: string
  title: string
  attachedAuditId: string | null
  updatedAt: string
  createdAt: string
}

export interface ConversationMessageView {
  id: string
  role: "user" | "assistant"
  content: string
  operation: string | null
  intent: string | null
  objective: string | null
  createdAt: string
}

export interface AuditOption {
  id: string
  title: string
  status: string
}

// Failure half of the ask-action contract. Production redacts anything thrown
// across the Server Action boundary (client: "Minified React error #441"),
// so failures return as data and the real message reaches the UI.
export interface AskActionError {
  type: "error"
  error: string
  conversationId?: string
}

export type AskActionResult = (ConversationResponse & { conversationId?: string }) | AskActionError

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asExtractedData(value: unknown): ExtractedData | null {
  if (!isRecord(value)) return null
  const { goals, deliverables, timeline, budget, projectType, clientSignals, missingInformation, confidence } = value
  if (!Array.isArray(goals) || !Array.isArray(deliverables) || !Array.isArray(clientSignals)) return null
  if (typeof confidence !== "number") return null
  return {
    goals: goals.filter((g): g is string => typeof g === "string"),
    deliverables: deliverables.filter((d): d is string => typeof d === "string"),
    timeline: typeof timeline === "string" ? timeline : null,
    budget: typeof budget === "string" ? budget : null,
    projectType: typeof projectType === "string" ? projectType : null,
    clientSignals: clientSignals.filter((s): s is string => typeof s === "string"),
    missingInformation: Array.isArray(missingInformation)
      ? missingInformation.filter((m): m is string => typeof m === "string")
      : [],
    confidence: Math.min(1, Math.max(0, confidence)),
  }
}

function estimatedCreditsFor(text: string, hasDocument: boolean): number {
  if (isGreeting(text)) return 0
  try {
    return priceForOperation(classifyOperation(text, hasDocument))
  } catch {
    return 1
  }
}

export async function askQuestionAction(input: AskInput): Promise<AskActionResult> {
  try {
    return await askQuestionInner(input)
  } catch (err) {
    // Production redacts anything thrown across the action boundary into an
    // opaque digest (client: "Minified React error #441"), so every failure
    // mode returns as data instead. Curated messages pass through verbatim.
    if (isRedirectError(err)) throw err
    return {
      type: "error",
      error: publicErrorMessage(err, "I couldn't prepare your answer. Please try again — nothing was charged for this attempt."),
    }
  }
}

async function askQuestionInner(input: AskInput): Promise<ConversationResponse & { conversationId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in to ask Dealenz.")
  if (!user.email_confirmed_at) throw new Error("Please verify your email address before using this feature.")
  if (!input.text || !input.text.trim()) throw new Error("A question is required.")
  // Greetings are a free inline answer with no thread ceremony: no
  // conversation row, no persisted turns, no credits, no consent prompt.
  if (isGreeting(input.text)) {
    return {
      type: "answer",
      text: DETERMINISTIC_GREETING,
      operation: "conversation",
      intent: "explore",
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
  // Ownership gate for attached documents: a row the user cannot see through
  // RLS is treated as missing, and the request is rejected, never degraded.
  if (input.auditId) {
    const { data: owned } = await supabase
      .from("audits")
      .select("id")
      .eq("id", input.auditId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!owned) throw new Error("Deal not found.")
  }

  // Ownership gate for conversations. A conversation binds to one user; a
  // mismatched attached audit is rejected before anything is persisted.
  let conversation: ConversationRow | null = null
  if (input.conversationId) {
    conversation = await getConversation(supabase as never, user.id, input.conversationId)
    if (!conversation) throw new Error("Conversation not found.")
    if (input.auditId && conversation.attached_audit_id && conversation.attached_audit_id !== input.auditId) {
      throw new Error("This conversation is attached to a different deal.")
    }
    if (input.auditId && !conversation.attached_audit_id) {
      const { error } = await supabase
        .from("conversations")
        .update({ attached_audit_id: input.auditId, updated_at: new Date().toISOString() })
        .eq("id", conversation.id)
        .eq("user_id", user.id)
      if (error) throw new Error("Failed to attach deal to conversation")
      conversation.attached_audit_id = input.auditId
    }
  } else {
    conversation = await createConversation(supabase as never, user.id, {
      firstText: input.text,
      attachedAuditId: input.auditId ?? null,
    })
  }

  if (!isGreeting(input.text)) {
    const { data: consentRow } = await supabase
      .from("user_ai_consents")
      .select("has_consented_to_ai_analysis")
      .eq("user_id", user.id)
      .maybeSingle()
    const hasConsented = (consentRow as { has_consented_to_ai_analysis?: boolean } | null)?.has_consented_to_ai_analysis === true
    if (!hasConsented) throw new Error("CONSENT_REQUIRED")
  }

  const ledger: LedgerClient = {
    rpc: async (functionName: string, args: Record<string, unknown> = {}) => {
      const result = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
        functionName,
        args
      )
      return { data: result.data, error: result.error }
    },
  }

  // Persist the user turn before the model call so the transcript is
  // durable even if the provider fails. History for the model is the
  // persisted last 12 messages, truncated again server-side before the
  // provider — the client slice is ignored beyond this point.
  const persistedHistory = await listMessages(supabase as never, user.id, conversation.id, 20)
  const serverHistory: Array<{ role: "user" | "assistant"; text: string }> = persistedHistory
    .slice(-12)
    .map((row) => ({ role: row.role, text: row.content }))
  await addMessage(supabase as never, {
    conversationId: conversation.id,
    userId: user.id,
    role: "user",
    content: input.text,
  })

  let response: Awaited<ReturnType<typeof answerQuestion>>
  try {
    response = await answerQuestion({
      text: input.text,
      auditId: conversation.attached_audit_id ?? input.auditId,
      userId: user.id,
      history: serverHistory,
      idempotencyKey: input.idempotencyKey,
    ports: {
      loadContext: async (auditId: string) => {
        const { data } = await supabase
          .from("audits")
          .select("context_envelope")
          .eq("id", auditId)
          .eq("user_id", user.id)
          .maybeSingle()
        const envelope = (data as { context_envelope?: unknown } | null)?.context_envelope
        if (envelope === null || envelope === undefined) return null
        try {
          return parseContextEnvelope(envelope)
        } catch {
          return null
        }
      },
      loadFacts: async (auditId: string) => {
        const { data } = await supabase
          .from("audits")
          .select("raw_input, structured_data")
          .eq("id", auditId)
          .eq("user_id", user.id)
          .maybeSingle()
        if (!data) return null
        const row = data as { raw_input?: unknown; structured_data?: unknown }
        const structured = isRecord(row.structured_data) ? row.structured_data.extractedData : undefined
        const extracted = asExtractedData(structured)
        if (!extracted) return null
        return { extracted, rawText: typeof row.raw_input === "string" ? row.raw_input : "" }
      },
      loadKnowledge: async (envelope) => {
        if (!envelope) return []
        const items = await fetchPublishedKnowledge(supabase as never)
        return resolveKnowledge(envelope, items, { asOf: new Date() })
      },
      aiCaller: async ({ systemPrompt, userContent, maxTokens }) => {
        try {
          const { text, meta } = await callAISurface("authenticated", { systemPrompt, userContent, temperature: 0.4, maxTokens })
          return { text, usage: meta.usage, provider: meta.primary.provider, model: meta.primary.model }
        } catch (err) {
          // Durable provider-failure record; the pipeline still owns the
          // user-facing outcome. Metadata only, never prompts or content.
          const category = err instanceof AIProviderError ? err.category : "unknown"
          const provider = err instanceof AIProviderError ? err.provider : "unknown"
          await reportError(supabase, {
            phase: "ai_failure",
            error: err,
            details: { surface: "authenticated", provider, category, operation: "conversation" },
            severity: "error",
            userId: user.id,
          })
          throw err
        }
      },
      ledger,
      policy: STANDARD_CREDIT_POLICY,
    },
    })
  } catch (err) {
    // Provider/infrastructure details never reach the client. The pipeline
    // voids the reservation on failure, so the charge claim below holds.
    throw new Error(
      publicErrorMessage(err, "I couldn't prepare your answer. Please try again — nothing was charged for this attempt.")
    )
  }

  // Persist the assistant turn and touch the conversation for ordering.
  // The persisted copy includes the pipeline's operation/intent/objective
  // where available, so history reloads are self-describing, but the live
  // path never trusts a client replay of those fields.
  if (response.type === "answer") {
    await addMessage(supabase as never, {
      conversationId: conversation.id,
      userId: user.id,
      role: "assistant",
      content: response.text,
      operation: response.operation,
      intent: response.intent,
      metadata: {
        findingsUsed: response.findingsUsed.map((finding) => ({
          ruleKey: finding.ruleKey,
          summary: finding.summary,
          severity: finding.severity,
        })),
        knowledgeSources: response.knowledgeSources.map((source) => ({
          itemKey: source.itemKey,
          title: source.title,
          jurisdiction: source.jurisdiction,
        })),
        deterministic: response.deterministic,
      },
    })
  } else if (response.type === "needs_document") {
    await addMessage(supabase as never, {
      conversationId: conversation.id,
      userId: user.id,
      role: "assistant",
      content: response.message,
      operation: response.operation,
      intent: response.intent,
    })
  } else if (response.type === "denied") {
    await addMessage(supabase as never, {
      conversationId: conversation.id,
      userId: user.id,
      role: "assistant",
      content: `I cannot run that right now: ${response.denialReason}. Credits pay for computation, and this one needs more than is available.`,
      operation: response.operation,
      intent: response.intent,
    })
  }
  await touchConversation(supabase as never, user.id, conversation.id)

  return { ...response, conversationId: conversation.id } as ConversationResponse & { conversationId: string }
}

export async function estimateAskCredits(text: string, hasDocument: boolean): Promise<number> {
  return estimatedCreditsFor(text, hasDocument)
}

export async function listAskConversations(): Promise<ConversationSummary[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in.")
  if (!user.email_confirmed_at) throw new Error("VERIFY_REQUIRED")
  const rows = await listConversations(supabase as never, user.id)
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    attachedAuditId: row.attached_audit_id,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }))
}

export async function getAskConversation(conversationId: string): Promise<{ conversation: ConversationSummary; messages: ConversationMessageView[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in.")
  if (!user.email_confirmed_at) throw new Error("VERIFY_REQUIRED")
  const conversation = await getConversation(supabase as never, user.id, conversationId)
  if (!conversation) throw new Error("Conversation not found.")
  const messages = await listMessages(supabase as never, user.id, conversation.id, 50)
  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      attachedAuditId: conversation.attached_audit_id,
      updatedAt: conversation.updated_at,
      createdAt: conversation.created_at,
    },
    messages: messages.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      operation: row.operation,
      intent: row.intent,
      objective: row.objective,
      createdAt: row.created_at,
    })),
  }
}

export async function getAskContext(): Promise<{ balance: number | null; audits: AuditOption[]; conversations: ConversationSummary[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in.")
  if (!user.email_confirmed_at) throw new Error("VERIFY_REQUIRED")
  let balance: number | null = null
  try {
    balance = await getCreditBalance({
      rpc: async (functionName: string, args: Record<string, unknown> = {}) => {
        const result = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
          functionName,
          args
        )
        return { data: result.data, error: result.error }
      },
    })
  } catch {
    balance = null
  }
  const [{ data: audits }, conversations] = await Promise.all([
    supabase.from("audits").select("id, title, status").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20),
    listConversations(supabase as never, user.id).catch(() => [] as ConversationRow[]),
  ])
  return {
    balance,
    audits: ((audits ?? []) as AuditOption[]),
    conversations: conversations.map((row) => ({
      id: row.id,
      title: row.title,
      attachedAuditId: row.attached_audit_id,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    })),
  }
}
