import { applyConstitution, validateOutputContract } from "@/lib/ai/constitution"
import { maxTokensForOperation, type AIOperation } from "@/lib/ai/operations"
import { isGreeting, DETERMINISTIC_GREETING } from "@/lib/conversation/classify"
import type { AIUsageRecord, CreditPolicy, TokenUsage } from "@/lib/ai/usage"
import { authorizeOperation, completeOperation, type Authorization } from "@/lib/credits/policy"
import type { LedgerClient } from "@/lib/credits/ledger"
import {
  CONSULTANT_ELICITATION_CAP,
  CONSULTANT_SYSTEM_PROMPT,
  parseConsultantCloseOut,
  stripConsultantCloseOut,
  type ConsultantCloseOut,
} from "@/lib/consultant/prompt"
import { createClient } from "@/lib/supabase/server"
import { normalizeDealType } from "@/lib/deal-type"
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"
import type { UserIntent } from "@/lib/ai/operations"
import { checkRateLimit } from "@/lib/rate-limit"

export interface ConsultantTurnInput {
  text: string
  conversationId?: string
  jurisdiction?: string | null
  idempotencyKey?: string
  historyOverride?: Array<{ role: "user" | "assistant"; text: string }>
}

export type ConsultantTurnResponse =
  | {
      type: "question"
      text: string
      conversationId: string
      turnIndex: number
      elicitationCap: number
      closeOut: ConsultantCloseOut | null
      usageRecord: AIUsageRecord | null
      creditsConsumed: number | null
      balance: number | null
    }
  | {
      type: "answer"
      text: string
      conversationId: string
      turnIndex: number
      closeOut: ConsultantCloseOut | null
      usageRecord: AIUsageRecord | null
      creditsConsumed: number | null
      balance: number | null
    }
  | {
      type: "deal_created"
      text: string
      conversationId: string
      auditId: string
      dealType: string
      closeOut: ConsultantCloseOut
      usageRecord: AIUsageRecord | null
      creditsConsumed: number | null
      balance: number | null
    }
  | { type: "denied"; denialReason: string; balance: number | null }

export interface ConsultantPorts {
  aiCaller(request: { systemPrompt: string; userContent: string; maxTokens: number }): Promise<{ text: string; usage?: TokenUsage; provider: string; model: string }>
  ledger: LedgerClient
  policy: CreditPolicy | null
}

function isDocumentPaste(text: string): boolean {
  return text.trim().length > 800
}

function buildConsultantPrompt(text: string, history: Array<{ role: string; text: string }>, turnIndex: number): { systemPrompt: string; userContent: string } {
  const historyBlock = history.length > 0 ? history.map((h) => `${h.role}: ${h.text.slice(0, 1000)}`).join("\n") : "No prior turns. This is the first message."
  const turnNote = turnIndex === 0 ? "This is the first message in the session. It is free; do not mention cost." : `Turn ${turnIndex + 1} of ${CONSULTANT_ELICITATION_CAP}. Budget remaining: ${CONSULTANT_ELICITATION_CAP - turnIndex - 1} elicitation turns after this one.`
  const systemPrompt = applyConstitution(CONSULTANT_SYSTEM_PROMPT, "consultation")
  const userContent = [turnNote, `Conversation so far:\n${historyBlock}`, `Latest user message: ${text}`].join("\n\n")
  return { systemPrompt, userContent }
}

function titleFrom(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim().slice(0, 80)
  return normalized.length > 0 ? normalized : "Consultation"
}

export async function handleConsultantTurn(
  input: ConsultantTurnInput,
  ports: ConsultantPorts
): Promise<ConsultantTurnResponse> {
  const rawText = input.text.trim()
  if (!rawText) throw new Error("A message is required")
  const text = rawText.slice(0, 8000)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in.")
  if (!user.email_confirmed_at) throw new Error("Please verify your email address before using this feature.")

  let isFirstTurnFree = !input.conversationId
  const operation: AIOperation = "consultation"

  if (isFirstTurnFree) {
    const freeTurnCheck = await checkRateLimit("consultant_free_turn")
    if (!freeTurnCheck.allowed) {
      isFirstTurnFree = false
    }
  }

  if (isGreeting(text) && !input.conversationId) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: titleFrom(text), attached_audit_id: null })
      .select("id")
      .single()
    const conversationId = (conv as { id: string } | null)?.id ?? ""
    if (conversationId) {
      await supabase.from("conversation_messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "user",
        content: text,
        operation,
        message_type: "consultation_turn",
        metadata: {},
      })
      await supabase.from("conversation_messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        content: DETERMINISTIC_GREETING,
        operation,
        message_type: "consultation_turn",
        metadata: { deterministic: true },
      })
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", user.id)
    }
    return {
      type: "question",
      text: DETERMINISTIC_GREETING,
      conversationId,
      turnIndex: 0,
      elicitationCap: CONSULTANT_ELICITATION_CAP,
      closeOut: null,
      usageRecord: null,
      creditsConsumed: null,
      balance: null,
    }
  }

  let conversationId = input.conversationId ?? null
  let history: Array<{ role: "user" | "assistant"; text: string }> = input.historyOverride ?? []
  let turnIndex = 0

  if (conversationId) {
    const { data: conv } = await supabase.from("conversations").select("id").eq("id", conversationId).eq("user_id", user.id).maybeSingle()
    if (!conv) throw new Error("Conversation not found.")
    const { data: messages } = await supabase
      .from("conversation_messages")
      .select("role, content, message_type")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50)
    const rows = (messages ?? []) as Array<{ role: string; content: string; message_type: string }>
    const consultationRows = rows.filter((r) => r.message_type === "consultation_turn" || r.message_type === "inline_confirmation")
    history = input.historyOverride ?? consultationRows.map((r) => ({ role: r.role as "user" | "assistant", text: r.content }))
    turnIndex = consultationRows.filter((r) => r.role === "user").length
    if (turnIndex >= CONSULTANT_ELICITATION_CAP) {
      return { type: "denied", denialReason: "Consultation turn limit reached", balance: null }
    }
  }

  if (isDocumentPaste(text)) {
    const dealType: string = "generic"
    const normalized = normalizeDealType(dealType)
    const seeded = seedEnvelopeForDealType(normalized)
    if (input.jurisdiction) {
      const confirmed = applyUserConfirmation(seeded, { jurisdiction: { value: input.jurisdiction, confidence: 1 } })
      Object.assign(seeded, confirmed)
    }
    const inserted = await supabase
      .from("audits")
      .insert({
        user_id: user.id,
        title: titleFrom(text),
        status: "draft",
        deal_type: normalized,
        context_envelope: JSON.parse(JSON.stringify(seeded)) as never,
        context_version: seeded.version,
        raw_input: text,
        source_type: "paste",
      })
      .select("id")
      .single()
    const audit = inserted.data as { id: string } | null
    if (!audit) throw new Error("Failed to create deal from document")
    if (!conversationId) {
      const { data: conv } = await supabase.from("conversations").insert({ user_id: user.id, title: titleFrom(text), attached_audit_id: audit.id }).select("id").single()
      conversationId = (conv as { id: string } | null)?.id ?? ""
    } else {
      await supabase.from("conversations").update({ attached_audit_id: audit.id, updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", user.id)
    }
    if (conversationId) {
      await supabase.from("conversation_messages").insert({ conversation_id: conversationId, user_id: user.id, role: "user", content: text, operation, message_type: "consultation_turn", metadata: {} })
      await supabase.from("conversation_messages").insert({ conversation_id: conversationId, user_id: user.id, role: "assistant", content: "Got it. I have created your deal from the pasted document.", operation, message_type: "consultation_turn", metadata: { auditId: audit.id, closeOut: { decision: "create_deal", dealType: normalized } } })
    }
    return {
      type: "deal_created",
      text: "Got it. I have created your deal from the pasted document.",
      conversationId: conversationId ?? "",
      auditId: audit.id,
      dealType: normalized,
      closeOut: { decision: "create_deal", dealType: normalized } as ConsultantCloseOut,
      usageRecord: null,
      creditsConsumed: null,
      balance: null,
    }
  }

  if (!isFirstTurnFree) {
    const authorization: Authorization = await authorizeOperation({
      ledger: ports.ledger,
      userId: user.id,
      operation,
      idempotencyKey: input.idempotencyKey,
      policy: ports.policy,
    })
    if (!authorization.authorized) {
      return { type: "denied", denialReason: authorization.denialReason ?? "Not authorized", balance: authorization.balance }
    }
    const { systemPrompt, userContent } = buildConsultantPrompt(text, history, turnIndex)
    const maxTokens = maxTokensForOperation(operation)
    try {
      const answer = await ports.aiCaller({ systemPrompt, userContent, maxTokens })
      const closeOut = parseConsultantCloseOut(answer.text)
      const displayText = stripConsultantCloseOut(answer.text)
      const violations: string[] = []
      const check = validateOutputContract(displayText)
      if (check.hasEmDash) violations.push("em-dash")
      if (check.isEmpty) violations.push("empty")
      void violations
      const completion = await completeOperation({
        ledger: ports.ledger,
        authorization,
        operation,
        provider: answer.provider,
        model: answer.model,
        usage: answer.usage,
        status: "success",
        policy: ports.policy,
      })

      if (!conversationId) {
        const { data: conv } = await supabase.from("conversations").insert({ user_id: user.id, title: titleFrom(text), attached_audit_id: null }).select("id").single()
        conversationId = (conv as { id: string } | null)?.id ?? ""
      }
      if (conversationId) {
        await supabase.from("conversation_messages").insert({ conversation_id: conversationId, user_id: user.id, role: "user", content: text, operation, message_type: "consultation_turn", metadata: {} })
        await supabase.from("conversation_messages").insert({ conversation_id: conversationId, user_id: user.id, role: "assistant", content: displayText, operation, message_type: "consultation_turn", metadata: { closeOut: closeOut ?? null } })
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", user.id)
      }

      if (closeOut?.decision === "create_deal" && closeOut.dealType) {
        const normalized = normalizeDealType(closeOut.dealType)
        const seeded = seedEnvelopeForDealType(normalized)
        const intentValue = typeof closeOut.intent === "string" ? closeOut.intent : null
        const prioritiesValue = Array.isArray(closeOut.priorities) ? closeOut.priorities : null
        let toPersist = seeded
        const updates: Record<string, { value: unknown; confidence?: number }> = {}
        if (intentValue) updates.intent = { value: intentValue }
        if (prioritiesValue) updates.priorities = { value: prioritiesValue }
        const jurisdictionValue = typeof closeOut.jurisdiction === "string" && closeOut.jurisdiction.trim().length > 0 ? closeOut.jurisdiction.trim() : null
        const effectiveJurisdiction = jurisdictionValue ?? (input.jurisdiction ?? null)
        if (effectiveJurisdiction) updates.jurisdiction = { value: effectiveJurisdiction }
        if (Object.keys(updates).length > 0) {
          try {
            toPersist = applyUserConfirmation(seeded, updates as never)
          } catch {
            toPersist = seeded
          }
        }
        const inserted = await supabase
          .from("audits")
          .insert({
            user_id: user.id,
            title: titleFrom(text),
            status: "draft",
            deal_type: normalized,
            context_envelope: JSON.parse(JSON.stringify(toPersist)) as never,
            context_version: toPersist.version,
            raw_input: history.map((h) => h.text).join("\n\n") + "\n\n" + text,
            source_type: "paste",
          })
          .select("id")
          .single()
        const audit = inserted.data as { id: string } | null
        if (audit && conversationId) {
          await supabase.from("conversations").update({ attached_audit_id: audit.id }).eq("id", conversationId).eq("user_id", user.id)
        }
        if (audit) {
          return {
            type: "deal_created",
            text: displayText,
            conversationId: conversationId ?? "",
            auditId: audit.id,
            dealType: normalized,
            closeOut,
            usageRecord: completion.record,
            creditsConsumed: completion.record.creditsConsumed,
            balance: completion.balance,
          }
        }
      }

      if (closeOut?.decision === "answer_directly") {
        return {
          type: "answer",
          text: displayText,
          conversationId: conversationId ?? "",
          turnIndex,
          closeOut,
          usageRecord: completion.record,
          creditsConsumed: completion.record.creditsConsumed,
          balance: completion.balance,
        }
      }

      return {
        type: "question",
        text: displayText,
        conversationId: conversationId ?? "",
        turnIndex,
        elicitationCap: CONSULTANT_ELICITATION_CAP,
        closeOut: closeOut ?? null,
        usageRecord: completion.record,
        creditsConsumed: completion.record.creditsConsumed,
        balance: completion.balance,
      }
    } catch (err) {
      await completeOperation({
        ledger: ports.ledger,
        authorization,
        operation,
        status: "pre_provider_failure",
        policy: ports.policy,
      }).catch(() => undefined)
      throw err
    }
  }

  const { systemPrompt, userContent } = buildConsultantPrompt(text, history, turnIndex)
  const maxTokens = maxTokensForOperation(operation)
  const answer = await ports.aiCaller({ systemPrompt, userContent, maxTokens })
  const closeOut = parseConsultantCloseOut(answer.text)
  const displayText = stripConsultantCloseOut(answer.text)
  if (!conversationId) {
    const { data: conv } = await supabase.from("conversations").insert({ user_id: user.id, title: titleFrom(text), attached_audit_id: null }).select("id").single()
    conversationId = (conv as { id: string } | null)?.id ?? ""
  }
  if (conversationId) {
    await supabase.from("conversation_messages").insert({ conversation_id: conversationId, user_id: user.id, role: "user", content: text, operation, message_type: "consultation_turn", metadata: {} })
    await supabase.from("conversation_messages").insert({ conversation_id: conversationId, user_id: user.id, role: "assistant", content: displayText, operation, message_type: "consultation_turn", metadata: { closeOut: closeOut ?? null } })
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", user.id)
  }

  if (closeOut?.decision === "create_deal" && closeOut.dealType) {
    const normalized = normalizeDealType(closeOut.dealType)
    const seeded = seedEnvelopeForDealType(normalized)
    const intentValue = typeof closeOut.intent === "string" ? closeOut.intent : null
    const prioritiesValue = Array.isArray(closeOut.priorities) ? closeOut.priorities : null
    let toPersist = seeded
    const updates: Record<string, { value: unknown; confidence?: number }> = {}
    if (intentValue) updates.intent = { value: intentValue }
    if (prioritiesValue) updates.priorities = { value: prioritiesValue }
    const jurisdictionValue = typeof closeOut.jurisdiction === "string" && closeOut.jurisdiction.trim().length > 0 ? closeOut.jurisdiction.trim() : null
    const effectiveJurisdiction = jurisdictionValue ?? (input.jurisdiction ?? null)
    if (effectiveJurisdiction) updates.jurisdiction = { value: effectiveJurisdiction }
    if (Object.keys(updates).length > 0) {
      try {
        toPersist = applyUserConfirmation(seeded, updates as never)
      } catch {
        toPersist = seeded
      }
    }
    const inserted = await supabase
      .from("audits")
      .insert({
        user_id: user.id,
        title: titleFrom(text),
        status: "draft",
        deal_type: normalized,
        context_envelope: JSON.parse(JSON.stringify(toPersist)) as never,
        context_version: toPersist.version,
        raw_input: history.map((h) => h.text).join("\n\n") + "\n\n" + text,
        source_type: "paste",
      })
      .select("id")
      .single()
    const audit = inserted.data as { id: string } | null
    if (audit && conversationId) {
      await supabase.from("conversations").update({ attached_audit_id: audit.id }).eq("id", conversationId).eq("user_id", user.id)
    }
    if (audit) {
      return {
        type: "deal_created",
        text: displayText,
        conversationId: conversationId ?? "",
        auditId: audit.id,
        dealType: normalized,
        closeOut,
        usageRecord: null,
        creditsConsumed: null,
        balance: null,
      }
    }
  }

  if (closeOut?.decision === "answer_directly") {
    return {
      type: "answer",
      text: displayText,
      conversationId: conversationId ?? "",
      turnIndex,
      closeOut,
      usageRecord: null,
      creditsConsumed: null,
      balance: null,
    }
  }

  return {
    type: "question",
    text: displayText,
    conversationId: conversationId ?? "",
    turnIndex,
    elicitationCap: CONSULTANT_ELICITATION_CAP,
    closeOut: closeOut ?? null,
    usageRecord: null,
    creditsConsumed: null,
    balance: null,
  }
}
