"use client"

import { createClient } from "@/lib/supabase/client"
import { sanitizeFilename } from "@/lib/validation/files"
import { sanitizeUserError } from "@/lib/errors/sanitize"
import { attachFileMetadata } from "@/app/audit/[id]/actions"

// Single file-intake path for user-dropped deal documents (chat composer,
// audit/new). Uploads bytes to the caller-scoped storage path, then attaches
// metadata through the credit-gated server action — the server re-validates
// everything and fails closed, so this helper only fails fast on the
// obvious cases. On attach failure the orphaned object is removed so
// storage never holds files no analysis can see.
export type FileAttachResult = { ok: true } | { ok: false; error: string }

const MAX_BYTES = 10 * 1024 * 1024

function mimeForExtension(ext: string, declared: string): string | null {
  if (declared === "application/pdf" || declared === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || declared === "text/plain") {
    return declared
  }
  if (ext === "pdf") return "application/pdf"
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  if (ext === "txt") return "text/plain"
  return null
}

export async function uploadAndAttachFile(auditId: string, file: File): Promise<FileAttachResult> {
  try {
    const safeName = sanitizeFilename(file.name)
    const ext = safeName.split(".").pop()?.toLowerCase() ?? ""
    const mime = mimeForExtension(ext, file.type)
    if (!mime) {
      return { ok: false, error: "Unsupported file type. Dealenz reads PDF, DOCX, and TXT files." }
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return { ok: false, error: "That file must be non-empty and under 10 MB." }
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { ok: false, error: "You must be signed in." }
    }
    const storageKey = `${user.id}/${auditId}/${safeName}`
    const { error: upError } = await supabase.storage
      .from("audit-files")
      .upload(storageKey, file, { contentType: mime, upsert: false })
    if (upError) {
      return { ok: false, error: "We couldn't upload that file. Please try again." }
    }
    try {
      const attached = await attachFileMetadata(auditId, {
        name: safeName,
        size: file.size,
        type: mime,
        path: `audit-files/${storageKey}`,
      })
      if (!attached.ok) {
        await supabase.storage.from("audit-files").remove([storageKey]).catch(() => null)
        if (/insufficient credits/i.test(attached.error)) {
          return {
            ok: false,
            error: `${attached.error} Buy credits in Billing, or paste the contract text instead — analysis works the same.`,
          }
        }
        return { ok: false, error: attached.error }
      }
    } catch (e) {
      await supabase.storage.from("audit-files").remove([storageKey]).catch(() => null)
      const raw = e instanceof Error ? e.message : "We couldn't attach that file."
      if (/insufficient credits/i.test(raw)) {
        return {
          ok: false,
          error: `${raw} Buy credits in Billing, or paste the contract text instead — analysis works the same.`,
        }
      }
      return { ok: false, error: sanitizeUserError(raw) }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: sanitizeUserError(e instanceof Error ? e.message : "We couldn't attach that file. Please try again.") }
  }
}
