import type { ProviderResult, TokenUsage } from "../operations"
import { AIProviderError, type FailureCategory } from "../errors"

export interface OpenAICompatibleCallParams {
  systemPrompt: string
  userContent: string
  temperature?: number
  maxTokens?: number
  model?: string
  // BYOK overrides for this call only: a user-held key and optionally
  // their own endpoint (defaults to api.openai.com when blank so a plain
  // OpenAI key works without configuration). Fall back to env.
  apiKey?: string
  baseUrl?: string
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

function isPrivateByokHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "")
  if (h === "localhost" || h === "0.0.0.0" || h === "::" || h === "::1") return true
  if (h === "169.254.169.254" || h === "100.100.100.200" || h === "metadata.google.internal") return true
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (h.startsWith("169.254.")) return true
  if (h.startsWith("fd") || h.startsWith("fc")) return true
  if (h.startsWith("fe80:")) return true
  if (h === "127.0.0.1") return true
  if (h.startsWith("::ffff:")) return true
  if (/^0x/i.test(h) || /^[0-9]+$/.test(h.replace(/\./g, ""))) return true
  return false
}

export function isSafeByokBaseUrl(raw: string): { ok: boolean; reason?: string } {
  if (!raw || raw.length > 500) return { ok: false, reason: "invalid endpoint" }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: "invalid endpoint URL" }
  }
  if (url.protocol !== "https:") return { ok: false, reason: "HTTPS required for custom endpoints" }
  if (url.username || url.password) return { ok: false, reason: "credentials in endpoint URL" }
  if (isPrivateByokHost(url.hostname)) return { ok: false, reason: "private/loopback/metadata host blocked" }
  return { ok: true }
}

function buildUrl(baseUrl: string): string {
  if (baseUrl.endsWith("/chat/completions")) return baseUrl
  return `${baseUrl}/chat/completions`
}

export interface OpenAIResolvedRequest {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
  model: string
  systemPromptLength: number
  userContentLength: number
}

// Single place that builds the chat-completions request (buffered and
// streaming share it, so the two paths can never drift apart on model,
// attribution headers, or temperature).
export function resolveOpenAIRequest(params: OpenAICompatibleCallParams): OpenAIResolvedRequest {
  const { systemPrompt, userContent, temperature, maxTokens, model: modelOverride } = params
  const apiKey = params.apiKey ?? resolveKey()
  const rawBaseUrl = (params.baseUrl?.trim() || undefined) ?? resolveBaseUrl()
  const baseUrl = rawBaseUrl.replace(/\/+$/, "")
  const check = isSafeByokBaseUrl(baseUrl)
  if (!check.ok) {
    throw new AIProviderError({
      provider: "openai_compatible",
      category: "invalid_request",
      message: `Custom endpoint rejected (${check.reason ?? "unsafe"})`,
    })
  }
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

  return {
    url,
    headers,
    body: {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: temperature ?? 0.4,
      max_tokens: maxTokens ?? 8192,
    },
    model,
    systemPromptLength: systemPrompt.length,
    userContentLength: userContent.length,
  }
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
  const { url, headers, body, model, systemPromptLength, userContentLength } = resolveOpenAIRequest(params)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const payload = JSON.stringify(body)
    const originHost = new URL(url).hostname.toLowerCase()
    let currentUrl = url
    let response: Response | null = null
    for (let hop = 0; hop <= 2; hop += 1) {
      const res = await fetch(currentUrl, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: payload,
        redirect: "manual",
      })
      const location = res.headers.get("location")
      const isRedirect = res.status >= 300 && res.status <= 308 && location
      if (!isRedirect || !location) {
        response = res
        break
      }
      const next = new URL(location, currentUrl)
      // Same-origin redirects only: cross-origin hops (the SSRF-via-redirect
      // shape) fail closed. Re-validate the hop target before following.
      if (next.hostname.toLowerCase() !== originHost) {
        throw new AIProviderError({
          provider: "openai_compatible",
          category: "invalid_request",
          message: "Custom endpoint attempted a cross-origin redirect — refused",
        })
      }
      const hopCheck = isSafeByokBaseUrl(next.origin)
      if (!hopCheck.ok) {
        throw new AIProviderError({
          provider: "openai_compatible",
          category: "invalid_request",
          message: `Custom endpoint redirect refused (${hopCheck.reason ?? "unsafe"})`,
        })
      }
      if (hop === 2) {
        throw new AIProviderError({
          provider: "openai_compatible",
          category: "invalid_request",
          message: "Custom endpoint redirected too many times",
        })
      }
      currentUrl = next.toString()
    }
    if (!response) {
      throw new AIProviderError({
        provider: "openai_compatible",
        category: "invalid_request",
        message: "Custom endpoint redirect chain failed",
      })
    }

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
        systemPromptLength,
        userContentLength,
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
