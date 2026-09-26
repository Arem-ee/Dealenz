import { AIProviderError } from "./errors"
import type { TokenUsage } from "./operations"

export interface StreamChatParams {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
  /** Abort after this long without a completed response. Streams stay open. */
  timeoutMs?: number
  provider: "openai_compatible" | "anthropic"
}

export interface StreamChatResult {
  text: string
  usage?: TokenUsage
}

interface OpenAIChunkChoice {
  delta?: { content?: unknown }
  finish_reason?: unknown
}

interface OpenAIChunk {
  choices?: OpenAIChunkChoice[]
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }
}

function openAIUsage(chunk: OpenAIChunk): TokenUsage | undefined {
  const usage = chunk.usage
  if (!usage || typeof usage !== "object") return undefined
  const { prompt_tokens, completion_tokens } = usage as Record<string, unknown>
  if (typeof prompt_tokens !== "number" || typeof completion_tokens !== "number") return undefined
  if (!Number.isFinite(prompt_tokens) || !Number.isFinite(completion_tokens)) return undefined
  if (prompt_tokens < 0 || completion_tokens < 0) return undefined
  return { inputTokens: Math.floor(prompt_tokens), outputTokens: Math.floor(completion_tokens) }
}

interface AnthropicChunk {
  type?: unknown
  delta?: { type?: unknown; text?: unknown }
  usage?: { input_tokens?: unknown; output_tokens?: unknown }
}

function anthropicUsage(chunk: AnthropicChunk): TokenUsage | undefined {
  const usage = chunk.usage
  if (!usage || typeof usage !== "object") return undefined
  const { input_tokens, output_tokens } = usage as Record<string, unknown>
  const input = typeof input_tokens === "number" ? input_tokens : 0
  const output = typeof output_tokens === "number" ? output_tokens : 0
  if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) return undefined
  // message_start carries input_tokens, message_delta the output_tokens —
  // merge across events by keeping the running maximum per side.
  return { inputTokens: Math.floor(input), outputTokens: Math.floor(output) }
}

/**
 * Shared SSE transport for provider streaming. Both OpenAI-compatible
 * (OpenRouter default) and Anthropic speak `data: <json>` event streams;
 * only the delta extraction differs. Chunk boundaries are arbitrary byte
 * splits, so a text buffer reassembles partial lines before parsing.
 *
 * Throws AIProviderError on transport failure, non-2xx status, or empty
 * output — the same contract as the buffered adapters, so callers keep one
 * error path. Token text is NEVER logged.
 */
export async function streamChatContent(
  params: StreamChatParams,
  onToken: (delta: string) => void
): Promise<StreamChatResult> {
  const { url, headers, body, timeoutMs = 120_000, provider } = params
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify(body),
      })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError({ provider, category: "timeout", message: "Streaming request timed out" })
      }
      throw new AIProviderError({ provider, category: "network", message: "Streaming request failed before a response was received" })
    }
    if (!response.ok || !response.body) {
      const status = response.status
      const category = status === 401 || status === 403 ? "auth" : status === 429 ? "rate_limit" : status === 400 || status === 404 || status === 422 ? "invalid_request" : "provider"
      throw new AIProviderError({ provider, category, status, message: `Streaming request failed — HTTP ${status}` })
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let text = ""
    let usage: TokenUsage | undefined
    let sawDone = false

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data:")) continue
        const payload = trimmed.slice(5).trim()
        if (payload === "[DONE]") {
          sawDone = true
          continue
        }
        let chunk: unknown
        try {
          chunk = JSON.parse(payload)
        } catch {
          continue
        }
        if (provider === "anthropic") {
          const event = chunk as AnthropicChunk
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && typeof event.delta.text === "string") {
            text += event.delta.text
            onToken(event.delta.text)
          }
          const chunkUsage = anthropicUsage(event)
          if (chunkUsage) {
            usage = {
              inputTokens: Math.max(usage?.inputTokens ?? 0, chunkUsage.inputTokens),
              outputTokens: Math.max(usage?.outputTokens ?? 0, chunkUsage.outputTokens),
            }
          }
          if (event.type === "message_stop") sawDone = true
        } else {
          const event = chunk as OpenAIChunk
          const delta = event.choices?.[0]?.delta?.content
          if (typeof delta === "string" && delta.length > 0) {
            text += delta
            onToken(delta)
          }
          const chunkUsage = openAIUsage(event)
          if (chunkUsage) usage = chunkUsage
        }
      }
    }

    const finalText = text.trim()
    if (!finalText) {
      throw new AIProviderError({ provider, category: "malformed_response", message: "Streaming provider returned an empty response" })
    }
    void sawDone
    return { text: finalText, usage }
  } finally {
    clearTimeout(timeout)
  }
}
