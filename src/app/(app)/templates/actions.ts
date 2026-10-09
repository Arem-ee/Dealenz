"use server"

import { createClient } from "@/lib/supabase/server"
import { familyById } from "@/lib/documents/families"
import { assembleDraft } from "@/lib/documents/assembly"
import { defaultDealTypeForFamily, listTemplateOptions, type TemplateOption } from "@/lib/documents/templates"
import { addMessage, createConversation } from "@/lib/conversation/store"

export type { TemplateOption }

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

/** Standard template catalog (code-defined families). No auth needed to list. */
export async function listTemplates(
  dealTypeLabel?: string
): Promise<ActionOk<{ templates: TemplateOption[] }> | ActionFail> {
  try {
    return { ok: true, templates: listTemplateOptions(dealTypeLabel) }
  } catch {
    return { ok: false, error: "We couldn't load templates. Please try again." }
  }
}

/**
 * One-click standard contract creation: mints a deal + workspace thread,
 * assembles the family draft with blanks for missing variables, and persists
 * version 1. The user lands in the workspace to fill blanks and review.
 */
export async function createFromTemplate(input: {
  familyId: string
  jurisdiction?: string
  variables?: Record<string, string>
  language?: string
}): Promise<
  ActionOk<{ threadId: string; auditId: string; familyTitle: string; versionNumber: number; language: string; languageFallbacks: string[] }> | ActionFail
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }

  const family = familyById(input.familyId)
  if (!family) return { ok: false, error: "Unknown template." }
  const dealType = defaultDealTypeForFamily(family.id)
  if (!dealType) return { ok: false, error: "That template has no deal type." }

  const jurisdiction = (input.jurisdiction ?? "").trim() || "UNKNOWN"
  const variables: Record<string, string> = {}
  for (const [k, v] of Object.entries(input.variables ?? {})) {
    if (typeof v === "string" && v.trim()) variables[k] = v.trim()
  }

  const { isLocale } = await import("@/lib/i18n/locale")
  const language = isLocale(input.language) ? input.language : "en"
  const { getLocalizedOverrides } = await import("@/app/(app)/clauses/library")
  const { overrides } = await getLocalizedOverrides({ clauseIds: family.clauseIds, language })

  let assembled: ReturnType<typeof assembleDraft>
  try {
    assembled = assembleDraft(
      {
        familyId: family.id, dealType, jurisdiction: { country: jurisdiction, region: null }, findings: [], variables,
        language, localizedClauses: overrides,
      },
      new Date()
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Draft generation failed. Please try again." }
  }

  const firstText = `Started from template: ${family.title}`
  const { data: audit, error: auditError } = await supabase
    .from("audits")
    .insert({ user_id: user.id, title: family.title, deal_type: dealType, raw_input: firstText })
    .select("id")
    .single()
  if (auditError || !audit) return { ok: false, error: "We couldn't start that deal. Please try again." }
  const auditId = (audit as { id: string }).id

  try {
    const thread = await createConversation(supabase as never, user.id, { attachedAuditId: auditId, firstText })
    await addMessage(supabase as never, {
      conversationId: thread.id,
      userId: user.id,
      role: "user",
      content: firstText,
      operation: "draft",
      intent: "create",
    })
    await addMessage(supabase as never, {
      conversationId: thread.id,
      userId: user.id,
      role: "assistant",
      content: `${family.title} draft ready — version 1 below. Fill the blanks, then review.`,
      operation: "draft",
      intent: "create",
      metadata: { type: "template_first_draft", familyId: family.id },
    })
    const { data: versionRow, error: versionError } = await supabase
      .from("document_versions")
      .insert({
        audit_id: auditId,
        user_id: user.id,
        document_type: family.id,
        version_number: 1,
        content: assembled.draft.markdown,
        generation_method: "assembled",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single()
    if (versionError || !versionRow) throw new Error(versionError?.message ?? "Version not saved")
    if (assembled.anchors.length > 0) {
      await supabase.from("version_clause_spans").insert(
        assembled.anchors.map((a) => ({
          user_id: user.id,
          version_id: (versionRow as { id: string }).id,
          audit_id: auditId,
          clause_id: a.clauseId,
          start_offset: a.startOffset,
          end_offset: a.endOffset,
          template_version: a.templateVersion,
        }))
      )
    }
    // Library usage analytics, best-effort — never fails creation.
    void import("@/app/(app)/clauses/library")
      .then((m) => m.recordClauseUse({ templateIds: family.clauseIds }))
      .catch(() => undefined)
    return {
      ok: true, threadId: thread.id, auditId, familyTitle: family.title, versionNumber: 1,
      language: assembled.language, languageFallbacks: assembled.languageFallbacks,
    }
  } catch {
    await supabase.from("audits").delete().eq("id", auditId).eq("user_id", user.id)
    return { ok: false, error: "We couldn't save that draft. Please try again." }
  }
}
