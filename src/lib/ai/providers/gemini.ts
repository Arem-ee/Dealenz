export interface GeminiCallParams {
  systemPrompt: string
  userContent: string
  temperature?: number
  maxTokens?: number
}

function resolveGeminiKey(): string {
  const key = process.env.AI_API_KEY ?? process.env.GEMINI_API_KEY
  if (!key) throw new Error("AI_API_KEY (or legacy GEMINI_API_KEY) environment variable is not set")
  return key
}

function resolveGeminiModel(): string {
  return process.env.AI_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash"
}

function resolveGeminiBaseUrl(): string {
  const raw = process.env.AI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta"
  return raw.replace(/\/+$/, "")
}

export async function callGeminiProvider(params: GeminiCallParams): Promise<string> {
  const { systemPrompt, userContent, temperature, maxTokens } = params
  const apiKey = resolveGeminiKey()
  const model = resolveGeminiModel()
  const baseUrl = resolveGeminiBaseUrl()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: {
          temperature: temperature ?? 0.4,
          maxOutputTokens: maxTokens ?? 8192,
        },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[Gemini] HTTP", response.status, "Request body was:", {
        model,
        systemPromptLength: systemPrompt.length,
        userContentLength: userContent.length,
        errorBody,
      })
      throw new Error(`Gemini request failed — HTTP ${response.status}`)
    }

    const result = await response.json()
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error("Gemini returned an empty response")
    }

    return (text as string).trim()
  } finally {
    clearTimeout(timeout)
  }
}
