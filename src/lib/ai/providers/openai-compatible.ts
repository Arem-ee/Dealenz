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

export async function callOpenAICompatible(params: OpenAICompatibleCallParams): Promise<string> {
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

    return text.trim()
  } finally {
    clearTimeout(timeout)
  }
}
