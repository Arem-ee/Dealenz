// Authenticated conversation surface (Phase 5G).
//
// Thin bridge between the UI and the conversation request pipeline: verifies
// the session, enforces ownership on attached audits, assembles real ports
// (RLS-governed reads, authenticated AI surface, ledger RPCs, priced policy),
// and returns only serializable data. The client is trusted for nothing:
// no credits, provider, model, token counts, findings, or authority cross
// the boundary from the browser.

"use server"

import { createClient } from "@/lib/supabase/server"
import { answerQuestion, type ConversationResponse, type HistoryTurn } from "@/lib/conversation/request"
import { getCreditBalance, type LedgerClient } from "@/lib/credits/ledger"
import { STANDARD_CREDIT_POLICY } from "@/lib/credits/pricing"
import { fetchPublishedKnowledge, resolveKnowledge } from "@/lib/knowledge"
import { parseContextEnvelope } from "@/lib/context/schema"
import { callAISurface } from "@/lib/ai/client"
import type { ExtractedData } from "@/lib/ai/extract"

export interface AskInput {
  text: string
  auditId?: string
  history?: HistoryTurn[]
  idempotencyKey?: string
}

export interface AuditOption {
  id: string
  title: string
  status: string
}

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

export async function askQuestionAction(input: AskInput): Promise<ConversationResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in to ask Dealenz.")
  if (!user.email_confirmed_at) throw new Error("Please verify your email address before using this feature.")
  if (!input.text || !input.text.trim()) throw new Error("A question is required.")

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

  const ledger: LedgerClient = {
    rpc: async (functionName: string, args: Record<string, unknown> = {}) => {
      const result = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
        functionName,
        args
      )
      return { data: result.data, error: result.error }
    },
  }

  const history = Array.isArray(input.history) ? input.history.slice(-20) : []

  return answerQuestion({
    text: input.text,
    auditId: input.auditId,
    userId: user.id,
    history,
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
        const { text, meta } = await callAISurface("authenticated", { systemPrompt, userContent, temperature: 0.4, maxTokens })
        return { text, usage: meta.usage, provider: meta.primary.provider, model: meta.primary.model }
      },
      ledger,
      policy: STANDARD_CREDIT_POLICY,
    },
  })
}

export async function getAskContext(): Promise<{ balance: number | null; audits: AuditOption[] }> {
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
  const { data: audits } = await supabase
    .from("audits")
    .select("id, title, status")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20)
  return { balance, audits: ((audits ?? []) as AuditOption[]) }
}
