import type { ProviderResult, TokenUsage } from "../operations"

export interface OpenAICompatibleCallParams {
  systemPrompt: string
  userContent: string
  temperature?: number
  maxTokens?: number
  model?: string
}

function resolveKey(): string {
  const key = process.env.AI_API_KEY ?? process.env.GEMINI_API_KEY
  if (!key) throw new Error("AI_API_KEY (or legacy GEMINI_API_KEY) environment variable is not set")
  return key
}

function resolveModel(override?: string): string {
  return override ?? process.env.AI_MODEL ?? process.env.GEMINI_MODEL ?? "meta/llama-3.3-70b-instruct"
}

function resolveBaseUrl(): string {
  const raw = process.env.AI_BASE_URL ?? "https://integrate.api.nvidia.com/v1"
  return raw.replace(/\/+$/, "")
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

export async function callOpenAICompatible(params: OpenAICompatibleCallParams): Promise<ProviderResult> {
  const { systemPrompt, userContent, temperature, maxTokens, model: modelOverride } = params
  const apiKey = resolveKey()
  const model = resolveModel(modelOverride)
  const baseUrl = resolveBaseUrl()
  const url = buildUrl(baseUrl)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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
      console.error("[OpenAI-compatible] HTTP", response.status, "Request body was:", {
        model,
        systemPromptLength: systemPrompt.length,
        userContentLength: userContent.length,
        errorBody,
      })
      throw new Error(`OpenAI-compatible request failed — HTTP ${response.status}`)
    }

    const result = await response.json()
    const text: unknown =
      result?.choices?.[0]?.message?.content ??
      result?.choices?.[0]?.text ??
      result?.content

    if (typeof text !== "string" || !text.trim()) {
      console.error("[OpenAI-compatible] Unexpected response shape:", JSON.stringify(result).slice(0, 1000))
      throw new Error("OpenAI-compatible provider returned an empty response")
    }

    return { text: text.trim(), usage: extractUsage(result) }
  } finally {
    clearTimeout(timeout)
  }
}
