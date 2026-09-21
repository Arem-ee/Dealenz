// Log redaction (Phase 2 observability).
//
// Error tracking must never become a sensitive-data sink. Every value that
// reaches system_logs or the ops alert webhook passes through here:
// bounded length, secret-shaped patterns masked, and — by API design —
// callers can only attach scalar metadata they explicitly provide. There is
// no path that accepts raw deal content, documents, prompts, or responses.

export const MAX_LOG_STRING = 2000
export const MAX_LOG_MESSAGE = 2000

const SECRET_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  // API keys and payment secrets (provider, Anthropic, generic).
  { re: /\b(sk_live_[A-Za-z0-9_-]+)/g, replacement: "[REDACTED_API_KEY]" },
  { re: /\b(sk_test_[A-Za-z0-9_-]+)/g, replacement: "[REDACTED_API_KEY]" },
  { re: /\b(sk-ant-[A-Za-z0-9_-]{8,})/g, replacement: "[REDACTED_API_KEY]" },
  { re: /\b(whsec_[A-Za-z0-9_-]+)/g, replacement: "[REDACTED_SECRET]" },
  { re: /\b(nvapi-[A-Za-z0-9_-]+)/g, replacement: "[REDACTED_API_KEY]" },
  { re: /\b(AIza[A-Za-z0-9_-]{10,})/g, replacement: "[REDACTED_API_KEY]" },
  // OpenRouter (live AI provider) and Paddle (billing) keys.
  { re: /\b(sk-or-[A-Za-z0-9_-]{8,})/g, replacement: "[REDACTED_API_KEY]" },
  { re: /\b(pdl_[A-Za-z0-9_-]+)/g, replacement: "[REDACTED_API_KEY]" },
  // Bearer / token headers and key= query params that leak into messages.
  { re: /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, replacement: "$1[REDACTED]" },
  { re: /([?&](?:key|token|secret|signature)=)[^&\s]{4,}/gi, replacement: "$1[REDACTED]" },
]

/** Redact secret-shaped substrings and bound length. Never throws. */
export function redactText(value: unknown, maxLength = MAX_LOG_STRING): string {
  let text: string
  if (typeof value === "string") text = value
  else if (value instanceof Error) text = `${value.name}: ${value.message}`
  else if (value === null || value === undefined) return ""
  else {
    try {
      text = JSON.stringify(value) ?? String(value)
    } catch {
      return "[unserializable]"
    }
  }
  for (const { re, replacement } of SECRET_PATTERNS) {
    re.lastIndex = 0
    text = text.replace(re, replacement)
  }
  // Least-privilege on emails: keep the domain for routing debugging, drop
  // the local part (no user identifiers in operational logs).
  text = text.replace(
    /\b([A-Za-z0-9._%+-]{1,64})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    "[REDACTED_USER]@$2"
  )
  if (text.length > maxLength) text = text.slice(0, maxLength) + "…[truncated]"
  return text
}

export type LogScalar = string | number | boolean | null | undefined

/** Sanitize a caller-provided metadata record: scalar values only, each redacted. */
export function redactMetadata(
  details: Record<string, LogScalar> | undefined | null
): Record<string, string | number | boolean | null> {
  if (!details || typeof details !== "object") return {}
  const out: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "number" || typeof value === "boolean") {
      out[key.slice(0, 128)] = value
    } else if (typeof value === "string") {
      out[key.slice(0, 128)] = redactText(value)
    } else {
      out[key.slice(0, 128)] = null
    }
  }
  return out
}
