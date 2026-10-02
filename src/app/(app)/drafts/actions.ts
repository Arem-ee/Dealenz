"use server"

import { createClient } from "@/lib/supabase/server"
import { assembleDraft } from "@/lib/documents/assembly"
import { familiesForDealType, familyById } from "@/lib/documents/families"
import { getRequiredVariablesForFamily } from "@/lib/documents/variable-autofill"
import type { RuleResult } from "@/lib/rules/result"

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

export interface DraftVersionRow {
  id: string
  auditId: string
  dealTitle: string
  familyId: string
  familyTitle: string
  versionNumber: number
  status: string | null
  createdAt: string
}

/** List the user's generated versions with their deals, newest first. */
export async function listDrafts(): Promise<ActionOk<{ drafts: DraftVersionRow[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }

  const { data: versions, error } = await supabase
    .from("document_versions")
    .select("id, audit_id, document_type, version_number, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200)
  if (error || !versions) return { ok: false, error: "We couldn't load your drafts. Please try again." }

  const rows = versions as Array<{
    id: string; audit_id: string; document_type: string; version_number: number; status: string | null; created_at: string
  }>
  const auditIds = [...new Set(rows.map((v) => v.audit_id))]
  const titles = new Map<string, string>()
  if (auditIds.length > 0) {
    const { data: audits } = await supabase.from("audits").select("id, title").eq("user_id", user.id).in("id", auditIds)
    for (const a of ((audits ?? []) as Array<{ id: string; title: string | null }>)) {
      titles.set(a.id, a.title?.trim() ? a.title : "Untitled")
    }
  }
  return {
    ok: true,
    drafts: rows.map((v) => ({
      id: v.id,
      auditId: v.audit_id,
      dealTitle: titles.get(v.audit_id) ?? "Untitled",
      familyId: v.document_type,
      familyTitle: familyById(v.document_type)?.title ?? v.document_type,
      versionNumber: v.version_number,
      status: v.status,
      createdAt: v.created_at,
    })),
  }
}

export interface FamilyOption {
  id: string
  title: string
  description: string
  variables: string[]
}

/** Draftable families for a deal type with their merge fields. */
export async function draftFamilies(auditId: string): Promise<ActionOk<{ families: FamilyOption[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: audit } = await supabase
    .from("audits")
    .select("id, deal_type")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .maybeSingle()
  const row = audit as { id: string; deal_type: string | null } | null
  if (!row) return { ok: false, error: "Deal not found." }
  const dealType = row.deal_type ?? "generic"
  return {
    ok: true,
    families: familiesForDealType(dealType).map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      variables: getRequiredVariablesForFamily(f.id, dealType).filter((v) => v !== "jurisdiction"),
    })),
  }
}

/**
 * Generate a draft by deterministic assembly: template + autofilled
 * system data + blanks for the rest. Missing variables flow as fillable
 * blanks (standard friction); send stays blocked downstream until
 * assigned. Persists a new version row, never mutates history.
 */
export async function generateDraft(input: {
  auditId: string
  familyId: string
  jurisdiction?: string
  variables?: Record<string, string>
}): Promise<
  ActionOk<{ familyTitle: string; versionNumber: number; missingVariables: string[] }> | ActionFail
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }

  const family = familyById(input.familyId)
  if (!family) return { ok: false, error: "Unknown document family." }
  const { data: audit } = await supabase
    .from("audits")
    .select("id, deal_type, structured_data")
    .eq("id", input.auditId)
    .eq("user_id", user.id)
    .maybeSingle()
  const row = audit as { id: string; deal_type: string | null; structured_data: { deterministicFindings?: unknown } | null } | null
  if (!row) return { ok: false, error: "Deal not found." }
  const dealType = row.deal_type ?? "generic"
  if (!family.dealTypes.includes(dealType as never)) {
    return { ok: false, error: `That document doesn't fit a ${dealType.replace("_", " ")} deal.` }
  }

  const jurisdiction = (input.jurisdiction ?? "").trim() || "UNKNOWN"
  const variables: Record<string, string> = {}
  for (const [k, v] of Object.entries(input.variables ?? {})) {
    if (typeof v === "string" && v.trim()) variables[k] = v.trim()
  }
  const rawFindings = row.structured_data?.deterministicFindings
  const findings = (Array.isArray(rawFindings) ? rawFindings : []) as RuleResult[]

  let result: ReturnType<typeof assembleDraft>
  try {
    result = assembleDraft(
      { familyId: family.id, dealType, jurisdiction: { country: jurisdiction, region: null }, findings, variables },
      new Date()
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Draft generation failed. Please try again." }
  }

  const readNextVersion = async (): Promise<number> => {
    const { data: latest } = await supabase
      .from("document_versions")
      .select("version_number")
      .eq("audit_id", row.id)
      .eq("document_type", family.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle<{ version_number: number }>()
    return (typeof latest?.version_number === "number" ? latest.version_number : 0) + 1
  }
  const persistVersion = async (versionNumber: number) =>
    supabase.from("document_versions").insert({
      audit_id: row.id,
      user_id: user.id,
      document_type: family.id,
      version_number: versionNumber,
      content: result.draft.markdown,
      generation_method: "assembled",
      created_at: new Date().toISOString(),
    })
  const firstNumber = await readNextVersion()
  const first = await persistVersion(firstNumber)
  if (first.error) {
    const msg = first.error.message?.toLowerCase() ?? ""
    if (msg.includes("duplicate") || msg.includes("unique")) {
      const retryNumber = await readNextVersion()
      const retry = await persistVersion(retryNumber)
      if (retry.error) return { ok: false, error: "We couldn't save that draft. Please try again." }
      return { ok: true, familyTitle: family.title, versionNumber: retryNumber, missingVariables: result.missingVariables }
    }
    return { ok: false, error: "We couldn't save that draft. Please try again." }
  }
  return { ok: true, familyTitle: family.title, versionNumber: firstNumber, missingVariables: result.missingVariables }
}
