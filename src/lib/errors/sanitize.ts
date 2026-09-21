// User-facing error copy guard. Server internals (minified React errors,
// NEXT_* control-flow digests, raw stack fragments) must never reach a toast
// or any other surface the user reads — the app already curates every real
// server message, so anything matching an internal pattern is replaced with
// a generic, honest fallback. Server-side logging still keeps the original.
const GENERIC_FALLBACK = "We couldn't do that. Please try again."

const INTERNAL_PATTERNS = [
  /minified react error/i,
  /react\.dev\/errors/i,
  /\bNEXT_REDIRECT\b/,
  /\bNEXT_NOT_FOUND\b/,
  /\bdigest\s*:/i,
  /hydration (failed|mismatch)/i,
  /\bat\s+\w+ \(.+:\d+:\d+\)/,
]

export function sanitizeUserError(message: unknown): string {
  if (typeof message !== "string") return GENERIC_FALLBACK
  const trimmed = message.trim()
  if (trimmed.length === 0) return GENERIC_FALLBACK
  if (trimmed.length > 500) return GENERIC_FALLBACK
  if (INTERNAL_PATTERNS.some((p) => p.test(trimmed))) return GENERIC_FALLBACK
  return trimmed
}

export function errorDigest(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null
  const digest = (err as { digest?: unknown }).digest
  return typeof digest === "string" && digest.length > 0 ? digest.slice(0, 200) : null
}
