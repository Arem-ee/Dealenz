// Evidence source inspection (Phase 8).
//
// Deterministic retrieval only: resolves an Evidence reference against the
// current content of an owned audit (pasted input plus uploaded files) and
// reports what can honestly be shown. No AI calls, no ledger operations, no
// credit consumption. Ownership is enforced at every step: the audit row,
// every file path, and the evidence's own source binding must all agree.

"use server"

import { createClient } from "@/lib/supabase/server"
import { checkEvidence, type Evidence } from "@/lib/evidence/schema"
import { inspectEvidence, type InspectionStatus, type SourceDocument } from "@/lib/evidence/inspect"
import { extractTextFromBuffer } from "@/lib/text-extract"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Bounds a single viewer payload. Uploaded files are already capped at 10MB
// each by the extraction guard; the viewer truncates extracted text well
// below that so one huge document cannot dominate the response.
const MAX_VIEWER_CHARS_PER_DOCUMENT = 300_000
const MAX_VIEWER_DOCUMENTS = 10

export interface InspectedSource {
  status: InspectionStatus
  documentLabel: string | null
  // Full located document text (capped), for the viewer to render and
  // highlight. Present only when a document was actually located.
  documentText: string | null
  matchOffset: number | null
  quote: string | null
  message: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function buildSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  auditId: string
): Promise<SourceDocument[]> {
  const { data: audit, error } = await supabase
    .from("audits")
    .select("raw_input, structured_data")
    .eq("id", auditId)
    .eq("user_id", userId)
    .single()

  if (error || !audit) throw new Error("Audit not found")

  const documents: SourceDocument[] = []
  const row = audit as { raw_input?: unknown; structured_data?: unknown }
  if (typeof row.raw_input === "string" && row.raw_input.trim().length > 0) {
    documents.push({ label: "Pasted input", text: row.raw_input.slice(0, MAX_VIEWER_CHARS_PER_DOCUMENT) })
  }

  const structured = isRecord(row.structured_data) ? row.structured_data : {}
  const files = Array.isArray(structured.files)
    ? (structured.files as Array<Record<string, unknown>>)
    : []
  const expectedPrefix = `audit-files/${userId}/${auditId}/`
  for (const file of files.slice(0, MAX_VIEWER_DOCUMENTS)) {
    const path = typeof file.path === "string" ? file.path : ""
    const name = typeof file.name === "string" && file.name.trim().length > 0 ? file.name : "Uploaded file"
    const mimeType = typeof file.type === "string" ? file.type : ""
    // Storage paths are re-validated here exactly as at attach time: a
    // crafted path can never escape this audit's folder.
    if (!path.startsWith(expectedPrefix)) continue
    const storagePath = path.replace("audit-files/", "")
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("audit-files")
      .download(storagePath)
    if (downloadError || !fileData) continue
    try {
      const buffer = Buffer.from(await fileData.arrayBuffer())
      const text = await extractTextFromBuffer(buffer, mimeType)
      if (text.trim().length > 0) {
        documents.push({ label: name, text: text.slice(0, MAX_VIEWER_CHARS_PER_DOCUMENT) })
      }
    } catch {
      continue
    }
  }
  return documents
}

export type InspectSourceResult =
  | { ok: true; inspected: InspectedSource }
  | { ok: false; error: string }

// Failures return as data, never thrown: thrown server-action errors reach
// the browser as opaque minified digests, and an evidence viewer showing
// "Minified React error #441" is a trust violation for a trust product.
export async function inspectSourceEvidence(auditId: string, evidenceRaw: unknown): Promise<InspectSourceResult> {
  if (!UUID_RE.test(auditId)) return { ok: false, error: "Invalid audit ID." }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !UUID_RE.test(user.id)) return { ok: false, error: "You must be signed in to inspect evidence." }

  let evidence: Evidence
  try {
    evidence = checkEvidence(evidenceRaw)
  } catch {
    return { ok: false, error: "Invalid evidence reference." }
  }

  // The evidence must belong to this audit. Anything else — another audit's
  // evidence, conversation evidence without an audit binding, knowledge
  // references — is rejected, never reinterpreted.
  if (
    (evidence.sourceType === "audit_input" || evidence.sourceType === "extraction") &&
    evidence.sourceId !== auditId
  ) {
    return { ok: false, error: "This evidence does not belong to the requested deal." }
  }
  if (evidence.sourceType === "conversation_input" || evidence.sourceType === "knowledge") {
    return {
      ok: true,
      inspected: {
        status: "UNAVAILABLE",
        documentLabel: null,
        documentText: null,
        matchOffset: null,
        quote: evidence.quote,
        message:
          evidence.sourceType === "knowledge"
            ? "This observation references a curated knowledge source, shown with the answer. It has no document position to open."
            : "This observation comes from conversation rather than an attached document, so there is no document to open.",
      },
    }
  }

  let documents: SourceDocument[]
  try {
    documents = await buildSnapshot(supabase, user.id, auditId)
  } catch (e) {
    // Ownership failures stay specific (row invisible under RLS reads as
    // missing); anything else is a generic retrieval failure.
    if (e instanceof Error && e.message === "Audit not found") {
      return { ok: false, error: "Audit not found." }
    }
    return { ok: false, error: "We couldn't open that deal's documents. Please try again." }
  }
  const result = inspectEvidence(evidence, { auditId, documents })
  const locatedText =
    result.matchOffset !== null && result.documentLabel !== null
      ? (documents.find((d) => d.label === result.documentLabel)?.text ?? null)
      : null
  return {
    ok: true,
    inspected: {
      status: result.status,
      documentLabel: result.documentLabel,
      documentText: locatedText,
      matchOffset: result.matchOffset,
      quote: result.locatedQuote,
      message: result.message,
    },
  }
}
