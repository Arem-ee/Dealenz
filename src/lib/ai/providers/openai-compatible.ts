import type { ProviderResult, TokenUsage } from "../operations"
import { AIProviderError, type FailureCategory } from "../errors"

export interface OpenAICompatibleCallParams {
  systemPrompt: string
  userContent: string
  temperature?: number
  maxTokens?: number
  model?: string
}

function resolveKey(): string {
  const key = process.env.AI_API_KEY ?? process.env.GEMINI_API_KEY
  if (!key)
    throw new AIProviderError({
      provider: "openai_compatible",
      category: "config",
      message: "AI_API_KEY (or legacy GEMINI_API_KEY) environment variable is not set",
    })
  return key
}

function resolveModel(override?: string): string {
  return override ?? process.env.AI_MODEL ?? process.env.GEMINI_MODEL ?? "meta/llama-3.3-70b-instruct"
}

function resolveBaseUrl(): string {
  const raw = process.env.AI_BASE_URL ?? "https://integrate.api.nvidia.com/v1"
  return raw.replace(/\/+$/, "")
}

function isOpenRouterHost(baseUrl: string): boolean {
  return baseUrl.toLowerCase().includes("openrouter.ai")
}

// OpenRouter serves provider/model IDs (e.g. anthropic/claude-sonnet-5),
// not bare Anthropic IDs and not the NVIDIA default below. Sending the wrong
// shape returns HTTP 404 for every call — fail closed here with the variable
// names instead of burning latency on a doomed request.
function resolveOpenRouterModel(override?: string): string {
  const explicit = override ?? process.env.AI_MODEL ?? process.env.GEMINI_MODEL
  if (!explicit) {
    throw new AIProviderError({
      provider: "openai_compatible",
      category: "config",
      message: "AI_MODEL (or AUTH_AI_MODEL) must be set to an OpenRouter model id, e.g. anthropic/claude-sonnet-5",
    })
  }
  return explicit
}

function buildUrl(baseUrl: string): string {
  if (baseUrl.endsWith("/chat/completions")) return baseUrl
  return `${baseUrl}/chat/completions`
}

// Best-effort usage mapping (usage.prompt_tokens / completion_tokens).
// Absent or malformed usage yields undefined, never fabricated zeros.
function extractUsage(result: unknown): TokenUsage | undefined {
  if (typeof result !== "object" || result === null) return undefined
  const usage = (result as { usage?: unknown }).usage
  if (typeof usage !== "object" || usage === null) return undefined
  const { prompt_tokens, completion_tokens } = usage as Record<string, unknown>
  if (typeof prompt_tokens !== "number" || typeof completion_tokens !== "number") return undefined
  if (!Number.isFinite(prompt_tokens) || !Number.isFinite(completion_tokens)) return undefined
  if (prompt_tokens < 0 || completion_tokens < 0) return undefined
  return { inputTokens: Math.floor(prompt_tokens), outputTokens: Math.floor(completion_tokens) }
}

function categoryForStatus(status: number): FailureCategory {
  if (status === 401 || status === 403) return "auth"
  if (status === 429) return "rate_limit"
  // 404 on OpenAI-compatible endpoints almost always means an unknown model
  // id or a wrong path — retrying or falling back cannot fix configuration.
  if (status === 400 || status === 404 || status === 422) return "invalid_request"
  if (status >= 500) return "provider"
  return "provider"
}

export async function callOpenAICompatible(params: OpenAICompatibleCallParams): Promise<ProviderResult> {
  const { systemPrompt, userContent, temperature, maxTokens, model: modelOverride } = params
  const apiKey = resolveKey()
  const baseUrl = resolveBaseUrl()
  const onOpenRouter = isOpenRouterHost(baseUrl)
  const model = onOpenRouter ? resolveOpenRouterModel(modelOverride) : resolveModel(modelOverride)
  const url = buildUrl(baseUrl)

  // OpenRouter attribution headers (recommended by OpenRouter; sent only to
  // their host, never to other endpoints). Absent app URL simply omits Referer.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }
  if (onOpenRouter) {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim()
    if (appUrl) headers["HTTP-Referer"] = appUrl
    headers["X-Title"] = "Dealenz"
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: temperature ?? 0.4,
        max_tokens: maxTokens ?? 8192,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      // Metadata only: provider error bodies can echo request content, so
      // the body itself is truncated hard and never logged in full.
      console.error(JSON.stringify({
        event: "ai_provider_failure",
        surface: "openai_compatible",
        provider: "openai_compatible",
        model,
        status: response.status,
        failureCategory: categoryForStatus(response.status),
        systemPromptLength: systemPrompt.length,
        userContentLength: userContent.length,
        errorBody: errorBody.slice(0, 500),
      }))
      const category = categoryForStatus(response.status)
      throw new AIProviderError({
        provider: "openai_compatible",
        category,
        status: response.status,
        message:
          category === "auth"
            ? `OpenAI-compatible provider rejected credentials (HTTP ${response.status}) — check AI_API_KEY`
            : category === "invalid_request"
              ? `OpenAI-compatible provider rejected the request (HTTP ${response.status}) — check AI_MODEL/AUTH_AI_MODEL and AI_BASE_URL`
              : `OpenAI-compatible request failed — HTTP ${response.status}`,
      })
    }

    const result = await response.json()
    const text: unknown =
      result?.choices?.[0]?.message?.content ??
      result?.choices?.[0]?.text ??
      result?.content

    if (typeof text !== "string" || !text.trim()) {
      // Shape keys only: model output may contain deal content and must
      // never reach logs.
      const shape =
        result && typeof result === "object" ? Object.keys(result as Record<string, unknown>) : []
      console.error(JSON.stringify({
        event: "ai_malformed_response",
        surface: "openai_compatible",
        provider: "openai_compatible",
        model,
        responseKeys: shape.slice(0, 10),
      }))
      throw new Error("OpenAI-compatible provider returned an empty response")
    }

    return { text: text.trim(), usage: extractUsage(result) }
  } catch (err) {
    // Preserve categorized provider errors; classify transport failures so
    // timeouts and DNS/TLS outages are distinguishable in logs.
    if (err instanceof AIProviderError) throw err
    if (err instanceof Error && err.name === "AbortError") {
      throw new AIProviderError({
        provider: "openai_compatible",
        category: "timeout",
        message: "OpenAI-compatible request timed out after 30s",
      })
    }
    if (err instanceof TypeError) {
      throw new AIProviderError({
        provider: "openai_compatible",
        category: "network",
        message: "OpenAI-compatible request failed before receiving a response",
      })
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
