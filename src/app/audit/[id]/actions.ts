"use server"

import { createClient } from "@/lib/supabase/server"
import { extractTextFromBuffer } from "@/lib/text-extract"
import { extractProjectData } from "@/lib/ai/extract"
import { analyzeRisk, analyzeGenericRiskWithVisibleFailure } from "@/lib/ai/risk-analysis"
import { generateDocuments } from "@/lib/generate"
import { generateNegotiationPoints } from "@/lib/ai/negotiation"
import type { GenericRiskReport } from "@/lib/ai/risk-analysis"
import { checkRateLimit } from "@/lib/rate-limit"
import { logEvent, logDuration } from "@/lib/logger"
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
  "ai_consent",
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
    ai_consent?: boolean
    client_id?: string | null
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    throw new Error("Unauthorized")
  }

  const oldStatus = (await supabase.from("audits").select("status, title").eq("id", id).single()).data as { status: string; title: string } | null

  const updates: Record<string, unknown> = {}
  for (const key of Object.keys(data)) {
    if (!ALLOWED_FIELDS.has(key as "title")) continue
    const value = (data as Record<string, unknown>)[key]
    if (key === "status" && typeof value === "string" && !ALLOWED_STATUS_VALUES.has(value)) continue
    updates[key] = value
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

export async function attachFileMetadata(
  auditId: string,
  fileData: {
    name: string
    size: number
    type: string
    path: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isValidUUID(user.id)) {
    throw new Error("Unauthorized")
  }

  const expectedPrefix = `audit-files/${user.id}/${auditId}/`
  if (!fileData.path.startsWith(expectedPrefix)) {
    throw new Error("Invalid file path")
  }

  const { data: audit } = await supabase
    .from("audits")
    .select("structured_data")
    .eq("id", auditId)
    .single()

  if (!audit) throw new Error("Audit not found")

  const existing = (audit.structured_data as Record<string, unknown>) ?? {}
  const files = (existing.files as Array<Record<string, unknown>>) ?? []

  if (files.length >= MAX_FILES_PER_AUDIT) {
    throw new Error(`Maximum of ${MAX_FILES_PER_AUDIT} files allowed per audit`)
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

  if (error) throw new Error(error.message)

  await logEvent({
    audit_id: auditId,
    user_id: user.id,
    phase: "file_metadata_attach",
    status: "success",
  })

  await logActivity(user.id, "file_attached", { fileName: fileData.name }, auditId)

  return files
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

  const { data: audit } = await supabase
    .from("audits")
    .select("structured_data")
    .eq("id", auditId)
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
): Promise<{ success: boolean; data?: ExtractedData; riskReport?: RiskReport | GenericRiskReport; error?: string }> {
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

  if (!audit.ai_consent) {
    return { success: false, error: "You must consent to AI analysis before proceeding." }
  }

  const today = new Date().toISOString().split("T")[0]
  const { data: usage } = await supabase
    .from("usage_tracking")
    .select("count")
    .eq("user_id", user.id)
    .eq("action_type", "analyzeDeal")
    .eq("date", today)
    .maybeSingle()

  if (usage && usage.count >= 5) {
    return { success: false, error: "You've reached today's usage limit. Please try again tomorrow." }
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

  await supabase
    .from("audits")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", auditId)

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

    const fileTexts: string[] = []
    for (const file of files) {
      const storagePath = (file.path as string).replace("audit-files/", "")
      const { data: fileData, error: dlError } = await supabase.storage
        .from("audit-files")
        .download(storagePath)

      if (dlError || !fileData) {
        await logEvent({
          audit_id: auditId,
          user_id: user.id,
          phase: "file_processing",
          status: "failure",
          error_message: `Failed to download file: ${file.name}`,
        })
        continue
      }

      try {
        const buffer = Buffer.from(await fileData.arrayBuffer())
        const text = await extractTextFromBuffer(buffer, file.type as string)
        if (text.trim()) fileTexts.push(text)
      } catch {
        await logEvent({
          audit_id: auditId,
          user_id: user.id,
          phase: "file_processing",
          status: "failure",
          error_message: `Failed to extract text from file: ${file.name}`,
        })
      }
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

    const dealType = ((audit as Record<string, unknown>).deal_type as string) === "generic" ? "generic" : "freelance"
    const extracted = await extractProjectData(combinedInput, dealType)

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
    if (dealType === "generic") {
      try {
        const result = await analyzeGenericRiskWithVisibleFailure(extracted)
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
        const result = await analyzeRisk(extracted)
        riskReport = result.report
        usedFallback = result.usedFallback
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
        await logEvent({
          audit_id: auditId,
          user_id: user.id,
          phase: "risk_fallback",
          status: "success",
          error_message: "Gemini risk analysis failed, rule engine fallback used",
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

    let negotiationPoints: string[] | undefined
    let genericRiskDegraded = false
    if (dealType === "generic" && riskReport) {
      try {
        negotiationPoints = await generateNegotiationPoints(extracted, riskReport as GenericRiskReport)
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

    const structuredUpdate: Record<string, unknown> = { ...(structured ?? {}), extractedData: extracted }
    if (dealType === "generic") {
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

    await supabase.rpc("increment_usage", {
      p_action_type: "analyzeDeal",
      p_limit: 5,
    })

    return { success: true, data: extracted, riskReport }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    const errorType = err instanceof Error ? err.constructor.name : "UnknownError"

    await supabase
      .from("audits")
      .update({ status: "failed", locked_at: null, updated_at: new Date().toISOString() })
      .eq("id", auditId)

    await logEvent({
      audit_id: auditId,
      user_id: user.id,
      phase: "extraction",
      status: "failure",
      error_message: `${errorType}: ${errorMessage}`,
      duration_ms: logDuration(startMs),
    })

    await logActivity(user.id, "analysis_failed", { reason: errorMessage, errorType }, auditId)

    return {
      success: false,
      error: err instanceof Error ? err.message : "Analysis failed",
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

  const auditDealType = ((audit as Record<string, unknown>).deal_type as string) === "generic" ? "generic" : "freelance"
  if (auditDealType === "generic") {
    return { success: false, error: "Protection package is available for freelance deals only. For this agreement, review the risk report and negotiation points." }
  }

  const structured = audit.structured_data as Record<string, unknown> | null
  const extractedData = structured?.extractedData as ExtractedData | undefined
  const riskReport = audit.risk_report as RiskReport | null

  if (!extractedData || !riskReport) {
    return { success: false, error: "Complete the audit analysis before generating documents." }
  }

  const today = new Date().toISOString().split("T")[0]
  const { data: usage } = await supabase
    .from("usage_tracking")
    .select("count")
    .eq("user_id", user.id)
    .eq("action_type", "generateProtectionPackage")
    .eq("date", today)
    .maybeSingle()

  if (usage && usage.count >= 10) {
    return { success: false, error: "You've reached today's usage limit. Please try again tomorrow." }
  }

  await logEvent({
    audit_id: auditId,
    user_id: user.id,
    phase: "protection_package",
    status: "start",
  })

  try {
    const docMap = await generateDocuments(extractedData, riskReport)
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

    await supabase.rpc("increment_usage", {
      p_action_type: "generateProtectionPackage",
      p_limit: 10,
    })

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
      error: err instanceof Error ? err.message : "Generation failed",
    }
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

  const docTypes = ["proposal", "sow", "contract", "checklist"] as const
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
  userId: string,
  phase: string,
  status: "success" | "failure",
  errorMessage?: string
) {
  await logEvent({
    audit_id: auditId,
    user_id: userId,
    phase,
    status,
    error_message: errorMessage ?? null,
  })
}
