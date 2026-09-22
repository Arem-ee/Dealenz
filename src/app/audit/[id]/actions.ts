"use server"

import { createClient } from "@/lib/supabase/server"
import { extractTextFromBuffer } from "@/lib/text-extract"
import { extractProjectData, extractAndValidate } from "@/lib/ai/extract"
import { analyzeRisk, analyzeGenericRiskWithVisibleFailure } from "@/lib/ai/risk-analysis"
import { generateDocuments } from "@/lib/generate"
import { generateNegotiationPoints } from "@/lib/ai/negotiation"
import { ensureContextForAnalysis } from "./context-actions"
import { fetchPublishedKnowledge, resolveKnowledge, type KnowledgeCandidate } from "@/lib/knowledge"
import {
  evaluateApplicableRules,
  registerBuiltinRules,
  selectRelevantFindings,
  type Finding,
  type RuleResult,
} from "@/lib/rules"
import { verticalForDealType } from "@/lib/verticals"
import { attachEvidence } from "@/lib/evidence"
import type { GenericRiskReport } from "@/lib/ai/risk-analysis"
import { assembleDraft } from "@/lib/documents/assembly"
import { familyById } from "@/lib/documents/families"
import type { DraftDocument } from "@/lib/documents/types"
import { checkRateLimit } from "@/lib/rate-limit"
import { UPLOAD_CREDITS } from "@/lib/credits/pricing"
import {
  finalizeReservation,
  reserveCredits,
  voidReservation,
  type LedgerClient,
} from "@/lib/credits/ledger"
import { bucketForGenericFindings } from "@/lib/verticals/generic/rules"
import { logAIUsage, toUsageRecord, type UsageReporter } from "@/lib/ai/usage"
import type { AIOperation } from "@/lib/ai/operations"
import { deterministicRiskFloor, floorExceedsDisplay, diffFindingSets, type FindingDelta } from "@/lib/rules/result"
import { canGenerateDocuments } from "@/lib/protection"
import { logEvent, logDuration, reportAIFallback, reportError } from "@/lib/logger"
import { publicErrorMessage } from "@/lib/safe-error"
import { AIProviderError } from "@/lib/ai/errors"
import type { ExtractedData } from "@/lib/ai/extract"
import type { RiskReport } from "@/lib/risk/engine"
import type { GeneratedDocument } from "@/lib/generate"

const LOCK_TTL_MS = 5 * 60 * 1000
const MAX_FILES_PER_AUDIT = 10
const MAX_COMBINED_INPUT_LENGTH = 100_000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(id: string): boolean {
  return UUID_RE.test(id)
}

interface BusinessProfileForDocuments {
  business_name: string | null
  legal_entity: string | null
  address: string | null
  city: string | null
  country: string | null
  email: string | null
  phone: string | null
  website: string | null
  default_currency: string | null
  default_payment_terms: string | null
  standard_rate: number | null
  rate_unit: string | null
}

export interface ActivityEventPayload {
  fromStatus?: string
  toStatus?: string
  documentType?: string
  flagCount?: number
  fileName?: string
  [key: string]: unknown
}

async function logActivity(
  userId: string,
  eventType: string,
  payload: ActivityEventPayload,
  auditId?: string
) {
  const supabase = await createClient()
  await supabase.from("activity_events").insert({
    user_id: userId,
    audit_id: auditId ?? null,
    event_type: eventType,
    payload,
    created_at: new Date().toISOString(),
  })
}

function addBusinessProfileToDocument(content: string, profile: BusinessProfileForDocuments | null): string {
  if (!profile) return content

  const lines: string[] = []
  if (profile.business_name) lines.push(`Service Provider: ${profile.business_name}`)
  if (profile.legal_entity) lines.push(`Legal Entity: ${profile.legal_entity}`)
  const location = [profile.address, profile.city, profile.country].filter(Boolean).join(", ")
  if (location) lines.push(`Address: ${location}`)
  if (profile.email) lines.push(`Email: ${profile.email}`)
  if (profile.phone) lines.push(`Phone: ${profile.phone}`)
  if (profile.website) lines.push(`Website: ${profile.website}`)
  if (profile.default_currency) lines.push(`Currency: ${profile.default_currency}`)
  if (profile.default_payment_terms) lines.push(`Payment Terms: ${profile.default_payment_terms}`)
  if (profile.standard_rate) {
    lines.push(`Standard Rate: ${profile.standard_rate}${profile.rate_unit ? ` / ${profile.rate_unit}` : ""}`)
  }

  if (lines.length === 0) return content
  return `## Business Profile\n${lines.join("\n")}\n\n${content}`
}

const ALLOWED_FIELDS = new Set([
  "title",
  "raw_input",
  "source_type",
  "structured_data",
  "status",
  "client_id",
] as const)

const ALLOWED_STATUS_VALUES = new Set(["draft", "in_progress", "processing"])

export async function updateAudit(
  id: string,
  data: {
    title?: string
    raw_input?: string | null
    source_type?: string | null
    structured_data?: Record<string, unknown> | null
    status?: string
    client_id?: string | null
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    throw new Error("Unauthorized")
  }

  const oldStatus = (await supabase.from("audits").select("status, title").eq("id", id).eq("user_id", user.id).single()).data as { status: string; title: string } | null

  const updates: Record<string, unknown> = {}
  for (const key of Object.keys(data)) {
    if (!ALLOWED_FIELDS.has(key as "title")) continue
    const value = (data as Record<string, unknown>)[key]
    if (key === "status" && typeof value === "string" && !ALLOWED_STATUS_VALUES.has(value)) continue
    if (key === "structured_data" && value !== null && typeof value === "object" && !Array.isArray(value)) {
      // Client must not inject server-derived intelligence. Deterministic
      // findings and related artifacts are only set by analyzeDeal.
      const sd = value as Record<string, unknown>
      const sanitized: Record<string, unknown> = { ...sd }
      delete sanitized.extractedData
      delete sanitized.deterministicFindings
      delete sanitized.findingDelta
      delete sanitized.negotiationPoints
      delete sanitized.genericRiskDegraded
      delete sanitized.riskDegraded
      delete sanitized.rulesDegraded
      delete sanitized.monitoringExtracted
      delete sanitized.generatedDocuments
      updates[key] = sanitized
      continue
    }
    updates[key] = value
  }
  if (updates.client_id !== undefined && updates.client_id !== null) {
    if (!isValidUUID(updates.client_id as string)) {
      delete updates.client_id
    } else {
      const { data: cp } = await supabase.from("client_profiles").select("id").eq("id", updates.client_id as string).eq("user_id", user.id).maybeSingle()
      if (!cp) delete updates.client_id
    }
  }
  updates.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from("audits")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) throw new Error(error.message)

  if (updates.status && updates.status !== oldStatus?.status) {
    await logActivity(user.id, "status_changed", { fromStatus: oldStatus?.status, toStatus: updates.status as string }, id)
  }
  if (updates.title && updates.title !== oldStatus?.title) {
    await logActivity(user.id, "title_changed", { title: updates.title as string }, id)
  }
}

export type AttachFileResult =
  | { ok: true; files: Array<Record<string, unknown>> }
  | { ok: false; error: string }

export async function attachFileMetadata(
  auditId: string,
  fileData: {
    name: string
    size: number
    type: string
    path: string
  }
): Promise<AttachFileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Every expected failure returns { ok: false } instead of throwing:
  // thrown server-action errors reach the browser as an opaque framework
  // error, hiding the real reason (e.g. which check failed) from the user.
  if (!user || !isValidUUID(user.id)) {
    return { ok: false, error: "Unauthorized" }
  }

  if (!isValidUUID(auditId)) return { ok: false, error: "Invalid audit ID" }
  // Server-authoritative file validation: sanitize the name, then require
  // the exact owner-scoped path (no prefix-only match, no nested keys).
  const { sanitizeFilename, sniffUploadMime } = await import("@/lib/validation/files")
  const { isSupportedFileType, isValidFileSize } = await import("@/lib/text-extract")
  const safeName = sanitizeFilename(fileData.name)
  if (fileData.name !== safeName) {
    return { ok: false, error: "Invalid file name" }
  }
  if (typeof fileData.size !== "number" || !isValidFileSize(fileData.size)) {
    return { ok: false, error: "Invalid file size" }
  }
  if (typeof fileData.type !== "string" || !isSupportedFileType(fileData.type)) {
    return { ok: false, error: "Unsupported file type" }
  }
  const expectedPath = `audit-files/${user.id}/${auditId}/${safeName}`
  if (fileData.path !== expectedPath) {
    return { ok: false, error: "Invalid file path" }
  }

  // Byte-level verification: the stored bytes must exist, fit the size cap,
  // and sniff as the declared type. Client-supplied size/MIME are claims,
  // not facts — a renamed binary must fail here, before any credits move.
  const storageKey = `${user.id}/${auditId}/${safeName}`
  const { data: stored, error: dlError } = await supabase.storage
    .from("audit-files")
    .download(storageKey)
  if (dlError || !stored) {
    return { ok: false, error: "Uploaded file not found. Please upload again." }
  }
  const buffer = Buffer.from(await stored.arrayBuffer())
  if (!isValidFileSize(buffer.length)) {
    return { ok: false, error: "Invalid file size" }
  }
  if (sniffUploadMime(buffer) !== fileData.type) {
    return { ok: false, error: "File content does not match its declared type" }
  }

  // Credit gate at the point of use: file upload/parsing costs UPLOAD_CREDITS.
  // Same balance check as every other billable operation — never-purchased
  // accounts (free-signup grant only) cannot afford it. Deducted only when
  // the attach succeeds; failures release the hold.
  const ledger: LedgerClient = {
    rpc: async (functionName: string, args: Record<string, unknown> = {}) => {
      const result = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
        functionName,
        args
      )
      return { data: result.data, error: result.error }
    },
  }
  let uploadReservation: { allowed: boolean; reservationId: string | null }
  try {
    uploadReservation = await reserveCredits(ledger, {
      operation: "document_analysis",
      amount: UPLOAD_CREDITS,
      // Never embed the user-controlled filename: reserve_credits rejects
      // keys over 120 chars, and real filenames ("Isolex_openTILL_…")
      // blow past that. Uniqueness comes from the UUID alone.
      idempotencyKey: `upload:${auditId}:${fileData.size}:${crypto.randomUUID()}`,
    })
  } catch {
    // The reservation RPC itself failed (as opposed to denying for low
    // balance). Read the balance directly so a broke user hears
    // "insufficient credits" instead of "try again"; only a second failure
    // means the backend is genuinely unreachable.
    try {
      const { data: balData } = await supabase.rpc("credit_balance")
      const row = (Array.isArray(balData) ? balData[0] : balData) as { balance?: unknown } | null
      const balance = typeof row?.balance === "number" ? Math.floor(row.balance) : null
      if (balance !== null && balance < UPLOAD_CREDITS) {
        return { ok: false, error: `Insufficient credits for this operation. File upload costs ${UPLOAD_CREDITS} credits.` }
      }
    } catch {
      // Balance unreadable too — fall through to the generic message.
    }
    return { ok: false, error: "Could not verify credit balance. Please try again." }
  }
  if (!uploadReservation.allowed || !uploadReservation.reservationId) {
    return { ok: false, error: `Insufficient credits for this operation. File upload costs ${UPLOAD_CREDITS} credits.` }
  }

  try {
    const { data: audit } = await supabase
      .from("audits")
      .select("structured_data")
      .eq("id", auditId)
      .eq("user_id", user.id)
      .single()

    if (!audit) return { ok: false, error: "Audit not found" }

    const existing = (audit.structured_data as Record<string, unknown>) ?? {}
    const files = (existing.files as Array<Record<string, unknown>>) ?? []

    if (files.length >= MAX_FILES_PER_AUDIT) {
      return { ok: false, error: `Maximum of ${MAX_FILES_PER_AUDIT} files allowed per audit` }
    }

    files.push({
      ...fileData,
      uploaded_at: new Date().toISOString(),
    })

    const { error } = await supabase
      .from("audits")
      .update({
        structured_data: { ...existing, files },
        updated_at: new Date().toISOString(),
      })
      .eq("id", auditId)
      .eq("user_id", user.id)

    if (error) return { ok: false, error: "We couldn't attach that file. Please try again." }

    try {
      await finalizeReservation(ledger, {
        reservationId: uploadReservation.reservationId,
        consumptionAmount: UPLOAD_CREDITS,
        operation: "document_analysis",
      })
    } catch {
      // The attach itself succeeded; a settlement-only failure is logged for
      // ops rather than rewriting success into failure.
      await logEvent({
        audit_id: auditId,
        user_id: user.id,
        phase: "file_metadata_settle",
        status: "failure",
      })
    }

    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "file_metadata_attach",
      status: "success",
    })

    await logActivity(user.id, "file_attached", { fileName: fileData.name }, auditId)

    return { ok: true, files }
  } catch (e) {
    await voidReservation(ledger, uploadReservation.reservationId).catch(() => null)
    return { ok: false, error: e instanceof Error && e.message ? e.message : "We couldn't attach that file. Please try again." }
  }
}

export async function removeFileMetadata(
  auditId: string,
  filePath: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    throw new Error("Unauthorized")
  }
  if (!isValidUUID(auditId)) throw new Error("Invalid audit ID")
  const expectedPrefix = `audit-files/${user.id}/${auditId}/`
  if (!filePath.startsWith(expectedPrefix)) throw new Error("Invalid file path")

  const { data: audit } = await supabase
    .from("audits")
    .select("structured_data")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .single()

  if (!audit) throw new Error("Audit not found")

  const existing = (audit.structured_data as Record<string, unknown>) ?? {}
  const files = (existing.files as Array<Record<string, unknown>>) ?? []
  const filtered = files.filter((f) => f.path !== filePath)

  const { error } = await supabase
    .from("audits")
    .update({
      structured_data: { ...existing, files: filtered },
      updated_at: new Date().toISOString(),
    })
    .eq("id", auditId)
    .eq("user_id", user.id)

  if (error) throw new Error(error.message)

  await logEvent({
    audit_id: auditId,
    user_id: user.id,
    phase: "file_metadata_remove",
    status: "success",
  })

  return filtered
}

export async function analyzeDeal(
  auditId: string
): Promise<{ success: boolean; data?: ExtractedData; riskReport?: RiskReport | GenericRiskReport; error?: string; contextGate?: string; missingRequiredContext?: string[]; knowledgeCandidates?: KnowledgeCandidate[]; deterministicFindings?: RuleResult[]; findingDelta?: FindingDelta | null; riskDegraded?: boolean; rulesDegraded?: boolean }> {
  const startMs = Date.now()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    return { success: false, error: "Unauthorized" }
  }

  if (!user.email_confirmed_at) {
    return { success: false, error: "Please verify your email address before using this feature." }
  }

  if (!auditId) {
    return { success: false, error: "Audit ID is required" }
  }

  const { data: audit } = await supabase
    .from("audits")
    .select("*")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .single()

  if (!audit) {
    return { success: false, error: "Audit not found" }
  }

  {
    const { data: consentRow } = await supabase
      .from("user_ai_consents")
      .select("has_consented_to_ai_analysis")
      .eq("user_id", user.id)
      .maybeSingle()
    const hasConsented =
      (consentRow as { has_consented_to_ai_analysis?: boolean } | null)?.has_consented_to_ai_analysis === true
    if (!hasConsented) {
      return { success: false, error: "CONSENT_REQUIRED" }
    }
  }

  const ttlThreshold = new Date(Date.now() - LOCK_TTL_MS).toISOString()

  const { data: locked, error: lockError } = await supabase
    .from("audits")
    .update({ locked_at: new Date().toISOString() })
    .eq("id", auditId)
    .eq("user_id", user.id)
    .or(`locked_at.is.null,locked_at.lt.${ttlThreshold}`)
    .select("id")

  if (lockError || !locked || locked.length === 0) {
    return { success: false, error: "This audit is currently being analyzed. Please wait." }
  }

  // Credits are the only gate: the plan executor reserves ANALYSIS_CREDITS
  // before running (approval shows the estimate), and the direct path in
  // analyzeAndPostRisk reserves before calling. There is no free daily
  // allowance — a free account's only funds are its 10 signup credits.

  // Phase 5B context gate: analysis must not silently treat unresolved
  // required context as confirmed. Legacy audits without an envelope are
  // seeded from the stored deal_type column first (safe migration path).
  const gateCheck = await ensureContextForAnalysis(supabase, user.id, auditId, audit)
  if (!gateCheck.ready) {
    await supabase
      .from("audits")
      .update({ locked_at: null, updated_at: new Date().toISOString() })
      .eq("id", auditId)
      .eq("user_id", user.id)
    await logActivity(user.id, "analysis_blocked_context", { state: gateCheck.state }, auditId)
    return {
      success: false,
      error: gateCheck.message,
      contextGate: gateCheck.state,
      missingRequiredContext: gateCheck.missing,
    }
  }

  await supabase
    .from("audits")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", auditId)

  // Phase 5C/5D: resolve knowledge candidates right after the context gate so
  // deterministic rules below can observe them. Best-effort: an empty store
  // or a missing table yields [], never a failure.
  let knowledgeCandidates: KnowledgeCandidate[] = []
  try {
    const items = await fetchPublishedKnowledge(supabase)
    if (items.length > 0 && gateCheck.envelope) {
      knowledgeCandidates = resolveKnowledge(gateCheck.envelope, items, { asOf: new Date() })
    }
    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "knowledge",
      status: "success",
      error_message: `${knowledgeCandidates.length} candidate(s) resolved`,
    })
  } catch {
    knowledgeCandidates = []
  }

  await logActivity(user.id, "analysis_started", {}, auditId)

  await logEvent({
    audit_id: auditId,
    user_id: user.id,
    phase: "extraction",
    status: "start",
  })

  try {
    const structured = audit.structured_data as Record<string, unknown> | null
    const files = (structured?.files as Array<Record<string, string>>) ?? []

    // File downloads and text extraction run concurrently: files are
    // independent of each other, and sequential awaits here used to add one
    // full download+parse round trip per file to every analysis. Order is
    // preserved by index; a single bad file can never break the others
    // (each failure is logged and skipped, as before).
    const processed = await Promise.all(
      files.map(async (file): Promise<{ text: string | null; error: string | null }> => {
        try {
          const storagePath = (file.path as string).replace("audit-files/", "")
          const { data: fileData, error: dlError } = await supabase.storage
            .from("audit-files")
            .download(storagePath)

          if (dlError || !fileData) {
            return { text: null, error: `Failed to download file: ${file.name}` }
          }
          const buffer = Buffer.from(await fileData.arrayBuffer())
          const text = await extractTextFromBuffer(buffer, file.type as string)
          if (!text.trim()) return { text: null, error: null }
          return { text, error: null }
        } catch {
          return { text: null, error: `Failed to extract text from file: ${file.name}` }
        }
      })
    )
    const fileTexts: string[] = []
    for (const item of processed) {
      if (item.error) {
        await logEvent({
          audit_id: auditId,
          user_id: user.id,
          phase: "file_processing",
          status: "failure",
          error_message: item.error,
        })
        continue
      }
      if (item.text) fileTexts.push(item.text)
    }

    const inputParts = [
      audit.raw_input,
      ...fileTexts,
    ].filter((p): p is string => typeof p === "string" && p.trim().length > 0)

    if (inputParts.length === 0) {
      await supabase
        .from("audits")
        .update({ status: "failed", locked_at: null, updated_at: new Date().toISOString() })
        .eq("id", auditId)
      await logEvent({
        audit_id: auditId,
        user_id: user.id,
        phase: "extraction",
        status: "failure",
        error_message: "No content to analyze",
      })
      await logActivity(user.id, "analysis_failed", { reason: "No content to analyze" }, auditId)
      return { success: false, error: "No content to analyze. Add text or upload files first." }
    }

    let combinedInput = inputParts.join("\n\n---\n\n")

    if (combinedInput.length > MAX_COMBINED_INPUT_LENGTH) {
      combinedInput = combinedInput.slice(0, MAX_COMBINED_INPUT_LENGTH)
    }

    const dealTypeRaw = (audit as Record<string, unknown>).deal_type as string
    const dealType =
      dealTypeRaw === "generic" ||
      dealTypeRaw === "lease" ||
      dealTypeRaw === "purchase_sale" ||
      dealTypeRaw === "employment" ||
      dealTypeRaw === "founder" ||
      dealTypeRaw === "partnership"
        ? dealTypeRaw
        : "freelance"
    // Token-cost measurement (bundle pricing input): every AI step reports
    // measured usage with its product context into system_logs. Best-effort
    // and non-blocking; a logging failure never fails the analysis.
    const reportUsage = (operation: AIOperation, step: string): UsageReporter => (info) => {
      void logAIUsage(
        toUsageRecord({
          operation,
          provider: info.provider,
          model: info.model,
          usage: info.usage,
          status: info.status,
          dealType,
          step,
        }),
        { auditId, userId: user.id }
      ).catch(() => null)
    }
    const validation = await extractAndValidate(combinedInput, dealType, "authenticated", reportUsage("document_analysis", "extract"))

    if (!validation.valid) {
      await supabase
        .from("audits")
        .update({ status: "failed", locked_at: null, updated_at: new Date().toISOString() })
        .eq("id", auditId)
      await logEvent({
        audit_id: auditId,
        user_id: user.id,
        phase: "extraction",
        status: "failure",
        error_message: `Insufficient input: ${validation.reason}`,
      })
      await logActivity(user.id, "analysis_failed", { reason: `Insufficient input: ${validation.reason}` }, auditId)
      return { success: false, error: "That doesn't look like a deal yet. Add more detail about the agreement — paste a client email, contract clause, lease terms, or describe the deal in your own words." }
    }

    const extracted = validation.extractedData!

    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "extraction",
      status: "success",
      duration_ms: logDuration(startMs),
    })

    const riskStartMs = Date.now()
    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "risk",
      status: "start",
    })

    let riskReport: RiskReport | GenericRiskReport
    let usedFallback = false
    // riskDegraded is the user-visible half of usedFallback: the operator
    // already gets reportAIFallback, but the user must also see that this
    // rating is heuristic, not AI. Persisted server-side only (sanitized
    // from client writes in updateAudit).
    let riskDegraded = false
    // Lease analyses take the adaptive generic path, never the freelance
    // 8-category engine (mirrors analyzeRiskForDealType routing).
    if (dealType !== "freelance") {
      try {
        const result = await analyzeGenericRiskWithVisibleFailure(extracted, "authenticated", reportUsage("document_analysis", "risk"))
        riskReport = result.report
      } catch (riskErr) {
        await logEvent({
          audit_id: auditId,
          user_id: user.id,
          phase: "risk",
          status: "failure",
          error_message: riskErr instanceof Error ? riskErr.message : "Risk analysis error",
          duration_ms: logDuration(riskStartMs),
        })
        throw riskErr
      }
    } else {
      try {
        const result = await analyzeRisk(extracted, "authenticated", reportUsage("document_analysis", "risk"))
        riskReport = result.report
        usedFallback = result.usedFallback
        riskDegraded = result.usedFallback
      } catch (riskErr) {
        await logEvent({
          audit_id: auditId,
          user_id: user.id,
          phase: "risk",
          status: "failure",
          error_message: riskErr instanceof Error ? riskErr.message : "Risk analysis error",
          duration_ms: logDuration(riskStartMs),
        })
        throw riskErr
      }
      if (usedFallback) {
        await reportAIFallback(supabase, {
          surface: "authenticated",
          provider: "risk-analysis",
          operation: "risk",
          servedByFallback: true,
          userId: user.id,
          auditId,
        })
      }
    }

    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "risk",
      status: "success",
      duration_ms: logDuration(riskStartMs),
    })

    // Phase 5D: evaluate deterministic rules over context, extracted facts,
    // and knowledge candidates. Pure and side-effect free; a failure here
    // degrades to no findings rather than breaking analysis (reversible).
    // rulesDegraded marks that silent emptying so the UI can say "checks
    // could not complete" instead of "no risks found".
    let ruleResults: RuleResult[] = []
    let relevantFindings: Finding[] = []
    let rulesDegraded = false
    try {
      registerBuiltinRules()
      const vertical = verticalForDealType(dealType)
      if (vertical) vertical.registerPack()
      const verticalFacts =
        vertical !== null
          ? JSON.parse(
              JSON.stringify(vertical.deriveFacts(extracted, combinedInput, { type: "audit_input", id: auditId }))
            ) as unknown
          : undefined
      const rulesInput = {
        context: gateCheck.envelope!,
        facts: {
          budget: extracted.budget,
          timeline: extracted.timeline,
          deliverables: extracted.deliverables,
          projectType: extracted.projectType,
          confidence: extracted.confidence,
          ...(vertical !== null && verticalFacts !== undefined ? { [vertical.key]: verticalFacts } : {}),
        },
        knowledge: knowledgeCandidates,
        operation: "document_analysis" as const,
        evaluatedAt: new Date().toISOString(),
      }
      const run = evaluateApplicableRules(rulesInput, "document_analysis", dealType)
      // Attach supporting evidence to FAIL findings (pure post-processing;
      // findings without evidence stay possible and unchanged).
      ruleResults = attachEvidence(run.results, rulesInput, "document_analysis", dealType)
      // Generic deterministic bucket (AI-authority fix): override AI scores
      // with bucket-derived placeholders. AI summary/recommendations kept.
      if (dealType === "generic" && riskReport) {
        const bucket = bucketForGenericFindings(ruleResults)
        const gr = riskReport as GenericRiskReport & { overallScore: number; riskLevel: "Low" | "Medium" | "High" }
        gr.overallScore = bucket.score
        gr.riskLevel = bucket.level as GenericRiskReport["riskLevel"]
        const cats = (gr as { categories?: Record<string, { score: number; severity: "low" | "medium" | "high" }> }).categories
        if (cats && typeof cats === "object") {
          for (const cat of Object.values(cats)) {
            cat.score = bucket.score
            cat.severity = bucket.severity as "low" | "medium" | "high"
          }
        }
      }
      // Phase 21 deterministic floor (authority boundary): for the specialized
      // non-freelance verticals, the deterministic findings set a floor the
      // displayed AI headline may not undercut. An AI Low can never silently
      // hide a deterministic FAIL; an AI High with no deterministic FAIL is
      // preserved as advisory (no FAIL is fabricated). AI themes, summary,
      // and recommendations are always preserved as advisory text.
      if (
        (dealType === "lease" ||
          dealType === "purchase_sale" ||
          dealType === "employment" ||
          dealType === "founder" ||
          dealType === "partnership") &&
        riskReport
      ) {
        const floor = deterministicRiskFloor(ruleResults)
        const gr = riskReport as GenericRiskReport & { overallScore: number; riskLevel: "Low" | "Medium" | "High" }
        if (floorExceedsDisplay(floor.level, gr.riskLevel)) {
          gr.overallScore = floor.score
          gr.riskLevel = floor.level as GenericRiskReport["riskLevel"]
          const cats = (gr as { categories?: Record<string, { score: number; severity: "low" | "medium" | "high" }> }).categories
          if (cats && typeof cats === "object") {
            for (const cat of Object.values(cats)) {
              cat.score = floor.score
              cat.severity = floor.severity as "low" | "medium" | "high"
            }
          }
        }
      }
      // Negotiation synthesis reasons over the full FAIL set (limit 50 documents
      // the bound explicitly): findings are compact next to the full report
      // already in the prompt, so silent truncation here would only hide signal.
      relevantFindings = selectRelevantFindings(ruleResults, { operation: "document_analysis", limit: 50 })
      await logEvent({
        audit_id: auditId,
        user_id: user.id,
        phase: "rules",
        status: "success",
        error_message: `${ruleResults.filter((r) => r.status === "FAIL").length} finding(s) from ${ruleResults.length} rule(s)`,
      })
    } catch (rulesErr) {
      ruleResults = []
      relevantFindings = []
      rulesDegraded = true
      await logEvent({
        audit_id: auditId,
        user_id: user.id,
        phase: "rules",
        status: "failure",
        error_message: rulesErr instanceof Error ? rulesErr.message : "Rule evaluation failed",
      })
    }

    let negotiationPoints: string[] | undefined
    let genericRiskDegraded = false
    if (dealType !== "freelance" && riskReport) {
      try {
        // Deterministic findings feed synthesis as context to reason over;
        // the model explains them but never re-decides their status.
        negotiationPoints = await generateNegotiationPoints(extracted, riskReport as GenericRiskReport, "authenticated", relevantFindings, reportUsage("negotiation", "points"))
      } catch (negErr) {
        genericRiskDegraded = true
        negotiationPoints = []
        await logEvent({
          audit_id: auditId,
          user_id: user.id,
          phase: "negotiation_points",
          status: "failure",
          error_message: negErr instanceof Error ? negErr.message : "Negotiation points generation failed",
        })
      }
      if (!negotiationPoints || negotiationPoints.length === 0) {
        genericRiskDegraded = true
      }
    }

    const structuredUpdate: Record<string, unknown> = {
      ...(structured ?? {}),
      extractedData: extracted,
      // Degradation flags: server-written only, user-visible honesty about
      // what this analysis is (heuristic rating, incomplete checks).
      riskDegraded,
      rulesDegraded,
      // Persisted so the workspace can show why each finding fired (with its
      // evidence) without re-running evaluation. Recomputed on every analysis.
      deterministicFindings: ruleResults,
      // Redline re-check: diff against the previous run's persisted FAIL set.
      // Null on first analysis (no baseline). Previous rows are server-written
      // only (client writes are sanitized in updateAudit), but diffed
      // defensively anyway — malformed rows are ignored, never trusted.
      findingDelta: diffFindingSets(
        (structured as Record<string, unknown> | null)?.deterministicFindings,
        ruleResults
      ),
    }
    if (dealType !== "freelance") {
      structuredUpdate.negotiationPoints = negotiationPoints ?? []
      structuredUpdate.genericRiskDegraded = genericRiskDegraded
    }

    await supabase
      .from("audits")
      .update({
        status: "analyzed",
        locked_at: null,
        structured_data: structuredUpdate,
        risk_report: riskReport as unknown as Record<string, unknown>,
        overall_score: riskReport.overallScore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auditId)

    await logActivity(user.id, "analysis_completed", { score: riskReport.overallScore, riskLevel: riskReport.riskLevel }, auditId)

    // Referral MVP (Phase 22): attribute + reward on first successful
    // analysis. Best-effort by design: failures are logged and retried on
    // the next success; the analysis result is never affected. Attribution
    // is restricted to first analyses so existing accounts (stale cookie,
    // post-linking analysis) are never attributed here.
    try {
      const { cookies } = await import("next/headers")
      const { REFERRAL_COOKIE } = await import("@/lib/referrals/policy")
      const { processReferralPostAnalysis } = await import("@/lib/referrals/attribution")
      const cookieStore = await cookies()
      await processReferralPostAnalysis({
        getCookie: (name) => cookieStore.get(name)?.value,
        clearCookie: (name) => {
          cookieStore.set(name, "", { maxAge: 0, path: "/" })
        },
        findOtherAnalyzedAudits: async () => {
          const { data, error } = await supabase
            .from("audits")
            .select("id")
            .eq("user_id", user.id)
            .eq("status", "analyzed")
            .neq("id", auditId)
            .limit(2)
          if (error || !Array.isArray(data)) return []
          return (data as Array<{ id?: unknown }>)
            .filter((a) => typeof a.id === "string")
            .map((a) => ({ id: a.id as string }))
        },
        attributeReferral: async (code) => {
          const attr = await supabase.rpc("attribute_referral", { p_code: code })
          if (attr.error) return false
          const row = (Array.isArray(attr.data) ? attr.data[0] : attr.data) as { attributed?: unknown } | null
          return row?.attributed === true
        },
        claimReward: async () => {
          const claim = await supabase.rpc("claim_referral_reward")
          if (claim.error) return false
          const row = (Array.isArray(claim.data) ? claim.data[0] : claim.data) as { rewarded?: unknown } | null
          return row?.rewarded === true
        },
        log: async (event, payload) => {
          await logActivity(user.id, event, payload)
        },
      })
    } catch {
      // Referral bookkeeping must never fail an analysis.
    }

    return { success: true, data: extracted, riskReport, knowledgeCandidates, deterministicFindings: ruleResults, findingDelta: (structuredUpdate.findingDelta as FindingDelta | null) ?? null, riskDegraded, rulesDegraded }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    const errorType = err instanceof Error ? err.constructor.name : "UnknownError"
    // Provider cause chain (category/status only — AIProviderError messages
    // are constructed from fixed strings plus status codes, never keys,
    // prompts, or response bodies). Without this, a provider outage and a
    // malformed model response log identically.
    const cause = err instanceof Error ? (err as { cause?: unknown }).cause : undefined
    const causeInfo =
      cause instanceof AIProviderError
        ? ` [cause: ${cause.provider}/${cause.category}${cause.status ? ` HTTP ${cause.status}` : ""}]`
        : ""
    const loggedMessage = `${errorType}: ${errorMessage}${causeInfo}`.slice(0, 1000)

    await supabase
      .from("audits")
      .update({ status: "failed", locked_at: null, updated_at: new Date().toISOString() })
      .eq("id", auditId)

    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "extraction",
      status: "failure",
      error_message: loggedMessage,
      duration_ms: logDuration(startMs),
    })

    await logActivity(user.id, "analysis_failed", { reason: errorMessage, errorType }, auditId)

    return {
      success: false,
      // Raw provider errors never reach the client; the failure is logged above.
      error: publicErrorMessage(err, "Analysis failed. Please try again."),
    }
  }
}

export async function generateProtectionPackage(
  auditId: string
): Promise<{ success: boolean; documents?: GeneratedDocument[]; error?: string }> {
  const startMs = Date.now()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    return { success: false, error: "Unauthorized" }
  }

  if (!user.email_confirmed_at) {
    return { success: false, error: "Please verify your email address before using this feature." }
  }

  const { data: audit } = await supabase
    .from("audits")
    .select("*")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .single()

  if (!audit) {
    return { success: false, error: "Audit not found" }
  }

  {
    const { data: consentRow } = await supabase
      .from("user_ai_consents")
      .select("has_consented_to_ai_analysis")
      .eq("user_id", user.id)
      .maybeSingle()
    const hasConsented =
      (consentRow as { has_consented_to_ai_analysis?: boolean } | null)?.has_consented_to_ai_analysis === true
    if (!hasConsented) {
      return { success: false, error: "CONSENT_REQUIRED" }
    }
  }

  const auditDealTypeRaw = (audit as Record<string, unknown>).deal_type as string
  const auditDealType =
    auditDealTypeRaw === "generic" ||
    auditDealTypeRaw === "lease" ||
    auditDealTypeRaw === "purchase_sale" ||
    auditDealTypeRaw === "employment" ||
    auditDealTypeRaw === "founder" ||
    auditDealTypeRaw === "partnership"
      ? auditDealTypeRaw
      : "freelance"
  if (!canGenerateDocuments(auditDealType)) {
    return { success: false, error: "Protection package is available for freelance deals only. For this agreement, review the risk report and negotiation points." }
  }

  const structured = audit.structured_data as Record<string, unknown> | null
  const extractedData = structured?.extractedData as ExtractedData | undefined
  const riskReport = audit.risk_report as RiskReport | null

  if (!extractedData || !riskReport) {
    return { success: false, error: "Complete the audit analysis before generating documents." }
  }

  {
    const rate = await checkRateLimit("generateProtectionPackage")
    if (!rate.allowed) {
      return { success: false, error: rate.error ?? "Rate limit check failed. Please try again." }
    }
  }

  await logEvent({
    audit_id: auditId,
    user_id: user.id,
    phase: "protection_package",
    status: "start",
  })

  try {
    const docMap = await generateDocuments(extractedData, riskReport, "authenticated", (info) => {
      // Durable template-fallback record; fire-and-forget so generation
      // latency is unaffected. Metadata only, never document content.
      void reportAIFallback(supabase, {
        surface: "authenticated",
        provider: "document-generation",
        operation: `generate:${info.document}`,
        servedByFallback: true,
        userId: user.id,
        auditId,
      })
    })
    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("business_name, legal_entity, address, city, country, email, phone, website, default_currency, default_payment_terms, standard_rate, rate_unit")
      .eq("user_id", user.id)
      .maybeSingle<BusinessProfileForDocuments>()

    const timestamp = new Date().toISOString()
    const titleFor: Record<string, string> = {
      proposal: "Proposal",
      sow: "Scope of Work",
      contract: "Contract",
      checklist: "Checklist",
    }

    const documents: GeneratedDocument[] = []
    for (const [type, { content, method }] of Object.entries(docMap) as [string, { content: string; method: "ai" | "template" }][]) {
      const docType = type as GeneratedDocument["type"]
      const documentContent = addBusinessProfileToDocument(content, businessProfile)
      const doc: GeneratedDocument = {
        id: `${docType}-${Date.now()}`,
        type: docType,
        title: titleFor[type] ?? type,
        content: documentContent,
        createdAt: timestamp,
      }
      documents.push(doc)

      const { data: existing } = await supabase
        .from("document_versions")
        .select("version_number")
        .eq("audit_id", auditId)
        .eq("document_type", docType)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle<{ version_number: number }>()

      let nextVersionNumber = 1
      if (existing !== null) {
        if (typeof existing.version_number !== "number") {
          throw new Error("Invalid document version number")
        }
        nextVersionNumber = existing.version_number + 1
      }

      await supabase.from("document_versions").insert({
        audit_id: auditId,
        user_id: user.id,
        document_type: docType,
        version_number: nextVersionNumber,
        content: documentContent,
        generation_method: method,
        created_at: new Date().toISOString(),
      })
    }

    const methodSummary = Object.entries(docMap).map(([type, { method }]) => `${type}=${method}`).join(", ")
    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "protection_package_fallback",
      status: methodSummary.includes("template") ? "success" : "success",
      error_message: methodSummary,
    })

    await supabase
      .from("audits")
      .update({
        structured_data: { ...(structured ?? {}), generatedDocuments: documents },
        updated_at: new Date().toISOString(),
      })
      .eq("id", auditId)
      .eq("user_id", user.id)

    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "protection_package",
      status: "success",
      duration_ms: logDuration(startMs),
    })

    await logActivity(user.id, "documents_generated", { documentTypes: documents.map(d => d.type) }, auditId)

    // Populate checklist items from generated checklist
    const checklistDoc = docMap.checklist
    if (checklistDoc) {
      const lines = checklistDoc.content.split("\n")
      const items: { label: string; sortOrder: number }[] = []
      for (const line of lines) {
        const match = line.match(/^- \[.]\s+(.+)/)
        if (match) {
          items.push({ label: match[1].trim(), sortOrder: items.length })
        }
      }
      if (items.length > 0) {
        const { data: existingItems } = await supabase
          .from("checklist_items")
          .select("id")
          .eq("audit_id", auditId)
          .limit(1)
        if (!existingItems || existingItems.length === 0) {
          await supabase.from("checklist_items").insert(
            items.map(item => ({
              audit_id: auditId,
              user_id: user.id,
              label: item.label,
              sort_order: item.sortOrder,
            }))
          )
        }
      }
    }

    return { success: true, documents }
  } catch (err) {
    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "protection_package",
      status: "failure",
      error_message: err instanceof Error ? err.message : "Unknown error",
      duration_ms: logDuration(startMs),
    })

    return {
      success: false,
      error: publicErrorMessage(err, "Generation failed. Please try again."),
    }
  }
}

export async function generateBusinessOwnerDraft(
  auditId: string,
  familyId: string,
  jurisdictionCountry: string,
  variables: Record<string, string>
): Promise<{ success: boolean; draft?: DraftDocument; error?: string }> {
  const startMs = Date.now()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    return { success: false, error: "Unauthorized" }
  }
  if (!user.email_confirmed_at) {
    return { success: false, error: "Please verify your email address before using this feature." }
  }
  if (!auditId || !isValidUUID(auditId)) {
    return { success: false, error: "Invalid audit ID" }
  }
  if (!familyId || typeof familyId !== "string") {
    return { success: false, error: "Document family is required." }
  }
  if (!jurisdictionCountry || typeof jurisdictionCountry !== "string" || jurisdictionCountry.trim().length === 0) {
    return { success: false, error: "Jurisdiction is required. Select the country whose law should inform this draft." }
  }

  const family = familyById(familyId)
  if (!family) {
    return { success: false, error: "Unknown document family." }
  }

  const { data: audit } = await supabase.from("audits").select("*").eq("id", auditId).eq("user_id", user.id).single()
  if (!audit) {
    return { success: false, error: "Audit not found" }
  }
  {
    const { data: consentRow } = await supabase
      .from("user_ai_consents")
      .select("has_consented_to_ai_analysis")
      .eq("user_id", user.id)
      .maybeSingle()
    const hasConsented =
      (consentRow as { has_consented_to_ai_analysis?: boolean } | null)?.has_consented_to_ai_analysis === true
    if (!hasConsented) {
      return { success: false, error: "CONSENT_REQUIRED" }
    }
  }
  const auditDealTypeRaw = (audit as Record<string, unknown>).deal_type as string
  const DRAFT_SUPPORTED_DEAL_TYPES = ["founder", "partnership", "purchase_sale", "lease", "employment"] as const
  const auditDealType = (DRAFT_SUPPORTED_DEAL_TYPES as readonly string[]).includes(auditDealTypeRaw) ? auditDealTypeRaw : null
  if (!auditDealType || !family.dealTypes.includes(auditDealType as never)) {
    return { success: false, error: `Family ${familyId} does not support deal type ${auditDealTypeRaw}.` }
  }

  // Rate limit: reuse generation limit (10/day) to avoid second ledger
  {
    const rate = await checkRateLimit("generateProtectionPackage")
    if (!rate.allowed) {
      return { success: false, error: rate.error ?? "Rate limit check failed. Please try again." }
    }
  }

  // Load persisted findings (authoritative) — do not re-derive without evidence
  const structured = audit.structured_data as Record<string, unknown> | null
  const persistedFindings = (structured?.deterministicFindings as unknown) ?? []
  const findings = Array.isArray(persistedFindings) ? (persistedFindings as RuleResult[]) : []

  // Partnership structure for honest handling (LLP/LP/ordinary/UNKNOWN)
  let partnershipStructure: string | null = null
  if (auditDealType === "partnership") {
    const raw = (audit.raw_input as string | null) ?? ""
    // Minimal structure hint from facts would be ideal, but we can derive from raw + findings without inventing
    // For Phase 28, use variables or raw text hint; if absent, UNKNOWN
    partnershipStructure = (variables.partnership_structure as string) || null
    if (!partnershipStructure) {
      const lower = raw.toLowerCase()
      if (lower.includes("llp") || lower.includes("limited liability partnership")) partnershipStructure = "LLP"
      else if (lower.includes("limited partnership")) partnershipStructure = "LP"
      else if (lower.includes("partnership")) partnershipStructure = "ordinary partnership"
      else partnershipStructure = null
    }
  }

  try {
    const result = assembleDraft(
      {
        familyId: family.id,
        dealType: auditDealType,
        jurisdiction: { country: jurisdictionCountry.trim(), region: null },
        findings,
        variables,
        partnershipStructure,
      },
      new Date()
    )

    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "business_owner_draft",
      status: "success",
      error_message: `${family.id} for ${auditDealType} in ${jurisdictionCountry}: ${result.missingVariables.length} missing`,
      duration_ms: logDuration(startMs),
    })

    // Persist draft as a document_version for review/export/handoff (familyId
    // as document_type; migration 00042 allows the family ids). Persistence
    // stays best-effort for the returned draft, but failures are now visible
    // (previously swallowed silently, so drafts were never actually stored).
    const readMaxVersion = async (): Promise<number> => {
      const { data: existing } = await supabase
        .from("document_versions")
        .select("version_number")
        .eq("audit_id", auditId)
        .eq("document_type", family.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle<{ version_number: number }>()
      return existing !== null && typeof existing.version_number === "number"
        ? existing.version_number + 1
        : 1
    }
    const persistVersion = async (versionNumber: number) =>
      supabase.from("document_versions").insert({
        audit_id: auditId,
        user_id: user.id,
        document_type: family.id,
        version_number: versionNumber,
        content: result.draft.markdown,
        generation_method: "assembled",
        created_at: new Date().toISOString(),
      })
    try {
      const { error } = await persistVersion(await readMaxVersion())
      if (error) {
        // Concurrent generation can collide on version_number (now unique):
        // re-read and retry once instead of forking history.
        const msg = error.message?.toLowerCase() ?? ""
        if (msg.includes("duplicate") || msg.includes("unique")) {
          const { error: retryError } = await persistVersion(await readMaxVersion())
          if (retryError) throw retryError
        } else {
          throw error
        }
      }
    } catch (err) {
      await reportError(supabase, {
        phase: "business_owner_draft_persist",
        error: err,
        details: { family: family.id, dealType: auditDealType },
        severity: "warn",
        userId: user.id,
        auditId,
      })
    }

    return { success: true, draft: result.draft }
  } catch (err) {
    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "business_owner_draft",
      status: "failure",
      error_message: err instanceof Error ? err.message : "Draft generation failed",
      duration_ms: logDuration(startMs),
    })
    return { success: false, error: publicErrorMessage(err, "Draft generation failed. Please try again.") }
  }
}

export async function updateChecklistItem(
  itemId: string,
  data: { status?: string; notes?: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    throw new Error("Unauthorized")
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.status) updates.status = data.status
  if (data.notes !== undefined) updates.notes = data.notes

  const { data: updatedItem, error } = await supabase
    .from("checklist_items")
    .update(updates)
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("audit_id")
    .single()

  if (error) throw new Error(error.message)

  const auditId = updatedItem?.audit_id
  if (typeof auditId !== "string") {
    throw new Error("Checklist item is missing audit ID")
  }

  await logActivity(user.id, "checklist_item_updated", { itemId, status: data.status }, auditId)
}

export async function populateChecklistItems(
  auditId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    throw new Error("Unauthorized")
  }

  const { data: audit } = await supabase
    .from("audits")
    .select("structured_data")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .single()

  if (!audit) throw new Error("Audit not found")

  const structured = audit.structured_data as Record<string, unknown> | null
  const documents = structured?.generatedDocuments as { type: string; content: string }[] | undefined
  const checklistDoc = documents?.find(d => d.type === "checklist")
  if (!checklistDoc) throw new Error("No checklist document found")

  const lines = checklistDoc.content.split("\n")
  const items: { label: string; detail?: string; sortOrder: number }[] = []
  let currentDetail: string | undefined

  for (const line of lines) {
    const itemMatch = line.match(/^- \[.]\s+(.+)/)
    if (itemMatch) {
      items.push({ label: itemMatch[1].trim(), detail: currentDetail, sortOrder: items.length })
      currentDetail = undefined
    }
    const detailMatch = line.match(/^\s+- (.+)/)
    if (detailMatch) {
      currentDetail = detailMatch[1].trim()
    }
  }

  if (items.length > 0) {
    await supabase.from("checklist_items").insert(
      items.map(item => ({
        audit_id: auditId,
        user_id: user.id,
        label: item.label,
        detail: item.detail ?? null,
        sort_order: item.sortOrder,
      }))
    )
  }
}

export async function upsertBusinessProfile(
  data: Record<string, unknown>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    throw new Error("Unauthorized")
  }

  const allowedBusinessFields = new Set([
    "business_name", "legal_entity", "address", "city", "country",
    "email", "phone", "website", "default_currency", "default_payment_terms",
    "standard_rate", "rate_unit", "logo_url",
  ])

  const payload: Record<string, unknown> = {}
  for (const key of Object.keys(data)) {
    if (allowedBusinessFields.has(key)) payload[key] = data[key]
  }
  payload.user_id = user.id
  payload.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from("business_profiles")
    .upsert(payload, { onConflict: "user_id" })

  if (error) throw new Error(error.message)
}

export async function createShareToken(
  auditId: string,
  documentType: string
): Promise<{ success: boolean; token?: string; shareUrl?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    return { success: false, error: "Unauthorized" }
  }

  const docTypes = ["proposal", "sow", "contract", "checklist", "report"] as const
  if (!docTypes.includes(documentType as typeof docTypes[number])) {
    return { success: false, error: "Invalid document type" }
  }

  const { data: audit } = await supabase
    .from("audits")
    .select("id")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!audit) {
    return { success: false, error: "Audit not found or access denied" }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set. Share links cannot be generated. " +
      "Set this environment variable to your app's public URL."
    )
  }

  if (appUrl.includes("localhost") && process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL still points to localhost. " +
      "Update it to your production URL before generating share links."
    )
  }

  const token = crypto.randomUUID()

  const { data: existing } = await supabase
    .from("share_tokens")
    .select("id")
    .eq("audit_id", auditId)
    .eq("document_type", documentType)
    .is("revoked_at", null)
    .maybeSingle()

  if (existing) {
    await supabase
      .from("share_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", existing.id)
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  const { error } = await supabase.from("share_tokens").insert({
    audit_id: auditId,
    document_type: documentType,
    token,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "share_token_create",
      status: "failure",
      error_message: error.message,
    })
    return { success: false, error: error.message }
  }

  await logEvent({
    audit_id: auditId,
    user_id: user.id,
    phase: "share_token_create",
    status: "success",
  })

  return {
    success: true,
    token,
    shareUrl: `${appUrl}/view/${token}`,
  }
}

export async function revokeShareToken(
  tokenId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    return { success: false, error: "Unauthorized" }
  }

  if (!isValidUUID(tokenId)) {
    return { success: false, error: "Invalid token ID" }
  }

  const { data: tokenRecord } = await supabase
    .from("share_tokens")
    .select("audit_id")
    .eq("id", tokenId)
    .maybeSingle()

  if (!tokenRecord) {
    return { success: false, error: "Token not found or access denied" }
  }

  const { data: audit } = await supabase
    .from("audits")
    .select("id")
    .eq("id", tokenRecord.audit_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!audit) {
    return { success: false, error: "Token not found or access denied" }
  }

  const { error } = await supabase
    .from("share_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)

  if (error) {
    await logEvent({
      phase: "share_token_revoke",
      status: "failure",
      error_message: error.message,
    })
    return { success: false, error: error.message }
  }

  await logEvent({
    phase: "share_token_revoke",
    status: "success",
  })

  return { success: true }
}

export async function getShareStatus(
  auditId: string
): Promise<{
  success: boolean
  tokens?: Array<{
    id: string
    document_type: string
    token: string
    created_at: string
    expires_at: string
    revoked_at: string | null
    signature: { signed_by_name: string; signed_by_email: string; signed_at: string } | null
  }>
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    return { success: false, error: "Unauthorized" }
  }

  if (!isValidUUID(auditId)) {
    return { success: false, error: "Invalid audit ID" }
  }

  const { data: audit } = await supabase
    .from("audits")
    .select("id")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!audit) {
    return { success: false, error: "Access denied" }
  }

  const { data: tokens, error } = await supabase
    .from("share_tokens")
    .select(`
      id,
      document_type,
      token,
      created_at,
      expires_at,
      revoked_at,
      document_signatures (
        signed_by_name,
        signed_by_email,
        signed_at
      )
    `)
    .eq("audit_id", auditId)
    .order("created_at", { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const mapped = (tokens ?? []).map((t: Record<string, unknown>) => {
    const sigs = t.document_signatures as Array<Record<string, unknown>> | null
    return {
      id: t.id as string,
      document_type: t.document_type as string,
      token: t.token as string,
      created_at: t.created_at as string,
      expires_at: t.expires_at as string,
      revoked_at: t.revoked_at as string | null,
      signature: sigs && sigs.length > 0
        ? {
            signed_by_name: sigs[0].signed_by_name as string,
            signed_by_email: sigs[0].signed_by_email as string,
            signed_at: sigs[0].signed_at as string,
          }
        : null,
    }
  })

  return { success: true, tokens: mapped }
}

export async function getClientProfiles() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    return { success: false, error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("client_profiles")
    .select("id, name, company, email")
    .eq("user_id", user.id)
    .order("name")

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, profiles: data ?? [] }
}

export async function logDocumentActivity(
  auditId: string,
  documentType: string,
  activityType: "document_viewed" | "document_reviewed"
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    throw new Error("Unauthorized")
  }

  const { data: audit } = await supabase
    .from("audits")
    .select("id")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .single()

  if (!audit) throw new Error("Audit not found or access denied")

  await logActivity(
    user.id,
    activityType,
    { documentType },
    auditId
  )
}

export async function markDocumentReviewed(
  auditId: string,
  documentType: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    throw new Error("Unauthorized")
  }

  const { data: latest, error: fetchError } = await supabase
    .from("document_versions")
    .select("id")
    .eq("audit_id", auditId)
    .eq("user_id", user.id)
    .eq("document_type", documentType)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!latest) throw new Error("Document version not found")

  const { error: updateError } = await supabase
    .from("document_versions")
    .update({ reviewed: true, updated_at: new Date().toISOString() })
    .eq("id", latest.id)
    .eq("user_id", user.id)

  if (updateError) throw new Error(updateError.message)
}

export async function getDocumentReviewedStatus(
  auditId: string
): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    return []
  }

  const { data } = await supabase
    .from("document_versions")
    .select("document_type")
    .eq("audit_id", auditId)
    .eq("user_id", user.id)
    .eq("reviewed", true)

  return (data ?? []).map((r) => r.document_type as string)
}

export async function logAuditEvent(
  auditId: string,
  // second param is legacy client userId — ignored, identity derived from auth
  _legacyUserId: string,
  phase: string,
  status: "success" | "failure",
  errorMessage?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isValidUUID(user.id) || !isValidUUID(auditId)) return
  const { data: audit } = await supabase.from("audits").select("id").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  if (!audit) return
  await logEvent({
    audit_id: auditId,
    user_id: user.id,
    phase,
    status,
    error_message: errorMessage ?? null,
  })
}
