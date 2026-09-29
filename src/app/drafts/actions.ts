"use server"

import { createHash } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { toActionFailure } from "@/lib/action-result"

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export async function restoreVersionAsDraft(
  auditId: string,
  versionId: string
): Promise<{ ok: true; versionId: string; versionNumber: number } | { ok: false; error: string }> {
  try {
    if (!isUUID(auditId) || !isUUID(versionId)) return { ok: false as const, error: "Invalid version." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) {
      return { ok: false as const, error: "Please verify your email address before restoring versions." }
    }
    const { data: audit } = await supabase
      .from("audits")
      .select("id")
      .eq("id", auditId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!audit) return { ok: false as const, error: "Deal not found." }
    const { data: source } = await supabase
      .from("document_versions")
      .select("id, document_type, version_number, content")
      .eq("id", versionId)
      .eq("audit_id", auditId)
      .eq("user_id", user.id)
      .maybeSingle()
    const src = source as { id: string; document_type: string; version_number: number; content: string | null } | null
    if (!src || typeof src.content !== "string" || src.content.length === 0) {
      return { ok: false as const, error: "That version has no readable content to restore." }
    }
    const { data: latest } = await supabase
      .from("document_versions")
      .select("version_number")
      .eq("audit_id", auditId)
      .eq("document_type", src.document_type)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle<{ version_number: number }>()
    const nextVersionNumber = typeof latest?.version_number === "number" ? latest.version_number + 1 : 1
    const hash = createHash("sha256").update(src.content, "utf8").digest("hex")
    const { data: inserted, error } = await supabase
      .from("document_versions")
      .insert({
        audit_id: auditId,
        user_id: user.id,
        document_type: src.document_type,
        version_number: nextVersionNumber,
        content: src.content,
        generation_method: "restored",
        parent_version_id: src.id,
        content_hash: hash,
        provenance: { restored_from: src.id, change_summary: `Restored from v${src.version_number}` },
        status: "draft",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single()
    if (error || !inserted) {
      const { sanitizeUserError } = await import("@/lib/errors/sanitize")
      return { ok: false as const, error: sanitizeUserError(error?.message ?? "Could not restore that version.") }
    }
    return { ok: true as const, versionId: (inserted as { id: string }).id, versionNumber: nextVersionNumber }
  } catch (e) {
    return toActionFailure(e, "Could not restore that version.") as never
  }
}
