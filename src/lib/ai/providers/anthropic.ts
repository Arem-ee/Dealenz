// Anthropic Messages API adapter (Claude).
// Implements the genuine Anthropic API contract: POST /v1/messages with the
// x-api-key header and anthropic-version header, system prompt as a top-level
// field, and text extracted from the response content blocks. Structured
// output is handled the same way as every other adapter: the model is asked
// for raw JSON text and the domain layer parses and validates it.

import { AIProviderError, type FailureCategory } from "../errors"
import type { ProviderResult, TokenUsage } from "../operations"

export interface AnthropicCallParams {
  systemPrompt: string
  userContent: string
  temperature?: number
  maxTokens?: number
  model?: string
}

const ANTHROPIC_VERSION = "2023-06-01"
const TIMEOUT_MS = 60_000

function resolveApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new AIProviderError({
      provider: "anthropic",
      category: "config",
      message: "ANTHROPIC_API_KEY environment variable is not set",
    })
  }
  return key
}

function resolveBaseUrl(): string {
  const raw = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"
  return raw.replace(/\/+$/, "")
}

function resolveModel(override?: string): string {
  return override ?? process.env.AUTH_AI_MODEL ?? "claude-sonnet-5"
}

function clampTemperature(value: number | undefined): number {
  const t = value ?? 0.4
  return Math.min(1, Math.max(0, t))
}

function categoryForStatus(status: number, errorType?: string): FailureCategory {
  if (status === 401 || status === 403 || errorType === "authentication_error") return "auth"
  if (status === 429 || errorType === "rate_limit_error") return "rate_limit"
  if (status === 400 || status === 422 || errorType === "invalid_request_error") return "invalid_request"
  if (status >= 500 || errorType === "api_error" || errorType === "overloaded_error") return "provider"
  return "provider"
}

interface AnthropicTextBlock {
  type?: unknown
  text?: unknown
}

function extractUsage(result: unknown): TokenUsage | undefined {
  if (typeof result !== "object" || result === null) return undefined
  const usage = (result as { usage?: unknown }).usage
  if (typeof usage !== "object" || usage === null) return undefined
  const { input_tokens, output_tokens } = usage as Record<string, unknown>
  if (typeof input_tokens !== "number" || typeof output_tokens !== "number") return undefined
  if (!Number.isFinite(input_tokens) || !Number.isFinite(output_tokens)) return undefined
  if (input_tokens < 0 || output_tokens < 0) return undefined
  return { inputTokens: Math.floor(input_tokens), outputTokens: Math.floor(output_tokens) }
}

function extractText(result: unknown): string {
  if (typeof result !== "object" || result === null) {
    throw new AIProviderError({
      provider: "anthropic",
      category: "malformed_response",
      message: "Anthropic returned an unexpected response shape",
    })
  }
  const content = (result as { content?: unknown }).content
  if (!Array.isArray(content)) {
    throw new AIProviderError({
      provider: "anthropic",
      category: "malformed_response",
      message: "Anthropic returned an unexpected response shape",
    })
  }
  const text = (content as AnthropicTextBlock[])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("")
    .trim()
  if (!text) {
    throw new AIProviderError({
      provider: "anthropic",
      category: "malformed_response",
      message: "Anthropic returned an empty response",
    })
  }
  return text
}

export async function callAnthropicProvider(params: AnthropicCallParams): Promise<ProviderResult> {
  const { systemPrompt, userContent, temperature, maxTokens, model: modelOverride } = params
  const apiKey = resolveApiKey()
  const model = resolveModel(modelOverride)
  const url = `${resolveBaseUrl()}/v1/messages`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens ?? 8192,
          system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: userContent }],
          temperature: clampTemperature(temperature),
        }),
      })
    } catch (err) {
      if (err instanceof AIProviderError) throw err
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError({
          provider: "anthropic",
          category: "timeout",
          message: "Anthropic request timed out",
          cause: err,
        })
      }
      throw new AIProviderError({
        provider: "anthropic",
        category: "network",
        message: "Anthropic request failed before a response was received",
        cause: err,
      })
    }

    if (!response.ok) {
      // Read only the error type for classification; provider error messages
      // are never propagated so prompt or document content can never leak.
      let errorType: string | undefined
      try {
        const body = (await response.json()) as { error?: { type?: unknown } }
        if (typeof body?.error?.type === "string") errorType = body.error.type
      } catch {
        errorType = undefined
      }
      const category = categoryForStatus(response.status, errorType)
      console.error("[Anthropic] HTTP", response.status, "Request metadata:", {
        model,
        systemPromptLength: systemPrompt.length,
        userContentLength: userContent.length,
        errorType: errorType ?? "unknown",
      })
      throw new AIProviderError({
        provider: "anthropic",
        category,
        status: response.status,
        message: `Anthropic request failed — HTTP ${response.status}`,
      })
    }

    let result: unknown
    try {
      result = await response.json()
    } catch (err) {
      throw new AIProviderError({
        provider: "anthropic",
        category: "malformed_response",
        message: "Anthropic returned an unreadable response",
        cause: err,
      })
    }

    return { text: extractText(result), usage: extractUsage(result) }
  } finally {
    clearTimeout(timeout)
  }
}
