// Provider failure categories shared by every AI adapter and the fallback runner.
// Categories exist so the authenticated path can decide explicitly whether a
// Sonnet failure is worth retrying on Opus, instead of retrying blindly.

export type FailureCategory =
  | "config"
  | "auth"
  | "invalid_request"
  | "malformed_response"
  | "timeout"
  | "network"
  | "rate_limit"
  | "provider"

// Only these categories may trigger the authenticated fallback model.
// Rationale: timeout/network/rate_limit/provider failures may be transient or
// capacity-related; a malformed response may be model-specific. Auth, config,
// and invalid-request failures would fail identically on the fallback, so
// falling back would only burn latency and obscure the real problem.
const FALLBACKABLE_CATEGORIES: ReadonlySet<FailureCategory> = new Set([
  "timeout",
  "network",
  "rate_limit",
  "provider",
  "malformed_response",
])

export function isFallbackableCategory(category: FailureCategory): boolean {
  return FALLBACKABLE_CATEGORIES.has(category)
}

interface AIProviderErrorOptions {
  provider: string
  category: FailureCategory
  // Message must be built from fixed strings plus status codes only.
  // Never interpolate API keys, URLs containing keys, prompts, or raw
  // provider response bodies.
  message: string
  status?: number
  cause?: unknown
}

export class AIProviderError extends Error {
  readonly provider: string
  readonly category: FailureCategory
  readonly status?: number

  constructor(options: AIProviderErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = "AIProviderError"
    this.provider = options.provider
    this.category = options.category
    this.status = options.status
  }
}

// Normalizes any thrown value into an AIProviderError so the fallback runner
// can always read a category. Plain errors from legacy adapters are treated
// as provider failures (retryable); adapter bugs that throw non-Errors are
// surfaced as provider failures rather than crashing the classifier.
export function toProviderError(err: unknown, provider: string): AIProviderError {
  if (err instanceof AIProviderError) return err
  if (err instanceof Error) {
    return new AIProviderError({
      provider,
      category: "provider",
      message: `${provider} call failed: ${err.name}`,
      cause: err,
    })
  }
  return new AIProviderError({
    provider,
    category: "provider",
    message: `${provider} call failed with a non-error value`,
    cause: err,
  })
}
