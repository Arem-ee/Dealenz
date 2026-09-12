// File upload security boundaries (Phase 1 security hardening).
//
// Client-side checks are convenience only. Everything here runs again
// server-side: magic-byte sniffing (never trust client MIME alone),
// filename sanitization (no path traversal, no control characters),
// and explicit size caps. Pure functions, fully unit-tested.

export const MAX_FILENAME_LENGTH = 120

const SAFE_NAME_RE = /^[A-Za-z0-9._-]+$/

/** Server-authoritative filename: basename only, safe charset, bounded length. */
export function sanitizeFilename(raw: unknown): string {
  if (typeof raw !== "string") return "upload"
  const base = raw.split(/[\\/]/).pop() ?? ""
  // Separate extension (1-10 alnum chars) so it survives sanitization.
  let stem = base
  let ext = ""
  const dot = base.lastIndexOf(".")
  if (dot > 0 && dot < base.length - 1) {
    const candidate = base.slice(dot + 1)
    if (/^[A-Za-z0-9]{1,10}$/.test(candidate)) {
      ext = `.${candidate.toLowerCase()}`
      stem = base.slice(0, dot)
    }
  }
  let clean = stem
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+/, "")
    .replace(/[._]+$/, "")
  if (!clean) clean = "upload"
  let out = ext ? `${clean}${ext}` : clean
  if (out.length > MAX_FILENAME_LENGTH) {
    const keepExt = ext.length
    out = `${clean.slice(0, MAX_FILENAME_LENGTH - keepExt)}${ext}`
  }
  // Construction above only emits [A-Za-z0-9._-]; verify rather than trust.
  if (!SAFE_NAME_RE.test(out)) return `upload${ext}`
  return out
}

/** True for names that are already storage-safe (no traversal, charset, length). */
export function isSafeFilename(name: unknown): boolean {
  if (typeof name !== "string") return false
  if (name.length === 0 || name.length > MAX_FILENAME_LENGTH) return false
  if (name !== sanitizeFilename(name)) return false
  if (name.includes("..") || name.includes("/") || name.includes("\\")) return false
  return true
}

export const SUPPORTED_UPLOAD_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const

export type SupportedUploadMime = (typeof SUPPORTED_UPLOAD_MIMES)[number]

/**
 * Magic-byte / content sniffing. Returns the detected type, or null when the
 * content does not recognizably match one of the three supported types.
 * Never trusts the client-supplied MIME or extension.
 */
export function sniffUploadMime(buffer: Buffer): SupportedUploadMime | null {
  if (!buffer || buffer.length < 4) return null
  // PDF: %PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf"
  }
  // DOCX (OOXML): ZIP local file header PK\x03\x04
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  // TXT: strict UTF-8 decode of a sample + control-character ratio gate.
  // Rejects binaries masquerading as .txt (and garbage encodings) early.
  try {
    const sample = buffer.subarray(0, Math.min(buffer.length, 8192)).toString("utf-8")
    if (sample.includes("�")) return null
    let controls = 0
    for (let i = 0; i < sample.length; i++) {
      const code = sample.charCodeAt(i)
      if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) controls++
    }
    if (sample.length > 0 && controls / sample.length > 0.05) return null
    return "text/plain"
  } catch {
    return null
  }
}
