// Provider/internal markers that must never reach customers. Curated
// product errors ("Deal not found.", "That doesn't look like a deal yet…")
// contain none of these, so they pass through untouched.
const INTERNAL_MARKERS = [
  /gemini/i,
  /google(?!\s+docs|\s+sheets)/i,
  /anthropic/i,
  /claude/i,
  /openai/i,
  /nvidia/i,
  /generativelanguage/i,
  /\bmodel\b/i,
  /\btokens?\b/i,
  /http\s?\d{3}/i,
  /\b(401|403|429|500|502|503|504)\b/,
  /api[\s_-]?key/i,
  /quota/i,
  /fetch failed/i,
  /network/i,
  /econn|etimedout/i,
  /empty response/i,
  /no json object/i,
  /unauthorized/i,
  /forbidden/i,
]

/**
 * User-facing error boundary for authenticated AI operations. Internal
 * provider/infrastructure details collapse to the curated fallback; product
 * errors already written for customers pass through verbatim. Server-side
 * logging is the caller's job and keeps the raw error.
 */
export function publicErrorMessage(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : ""
  if (!message) return fallback
  if (INTERNAL_MARKERS.some((re) => re.test(message))) return fallback
  return message
}
