import { callGeminiProvider } from "./providers/gemini"
import { callOpenAICompatible } from "./providers/openai-compatible"
import { callAnthropicProvider } from "./providers/anthropic"
import {
  AIProviderError,
  isFallbackableCategory,
  toProviderError,
  type FailureCategory,
} from "./errors"
import type { ProviderResult, TokenUsage } from "./operations"

export type AIProviderName = "gemini" | "openai_compatible" | "anthropic"

// Product surface. Authenticated Deal Intelligence resolves its provider and
// model from AUTH_AI_* env (openai_compatible for OpenRouter, anthropic for
// direct Anthropic, gemini for Google). Every domain call declares its surface
// explicitly.
export type AISurface = "authenticated"

export interface CallAIParams {
  systemPrompt: string
  userContent: string
  temperature?: number
  maxTokens?: number
  // Explicit model override. When omitted, each adapter falls back to its
  // configured default so existing call sites keep working unchanged.
  model?: string
}

export interface SurfaceCallMeta {
  surface: AISurface
  primary: { provider: string; model: string }
  fallbackAttempted: boolean
  fallback?: { provider: string; model: string }
  // Present when the primary failed, even if the fallback then succeeded.
  failureCategory?: FailureCategory
  servedByFallback?: boolean
  // Measured provider token usage when reported. Absent means unreported,
  // never zero by default.
  usage?: TokenUsage
}

export function getActiveProviderName(): AIProviderName {
  const raw = (process.env.AI_PROVIDER ?? "").trim().toLowerCase()
  if (raw === "gemini") return "gemini"
  if (raw === "anthropic") return "anthropic"
  if (raw === "openai_compatible" || raw === "openai-compatible" || raw === "openai") return "openai_compatible"
  const baseUrl = process.env.AI_BASE_URL ?? ""
  if (baseUrl.includes("generativelanguage.googleapis.com")) return "gemini"
  if (baseUrl.includes("api.anthropic.com")) return "anthropic"
  const key = process.env.AI_API_KEY ?? process.env.GEMINI_API_KEY ?? ""
  if (key.startsWith("nvapi-") || baseUrl.includes("api.nvidia.com")) return "openai_compatible"
  return "openai_compatible"
}

function resolveAuthProvider(): AIProviderName {
  // OpenRouter-first: the default serves the declared production provider so
  // a missing AUTH_AI_PROVIDER can never silently route to direct Anthropic
  // (which then fails closed on a key nobody intends to create). Direct
  // Anthropic remains available only via explicit AUTH_AI_PROVIDER=anthropic.
  const raw = (process.env.AUTH_AI_PROVIDER ?? "openai_compatible").trim().toLowerCase()
  if (raw === "gemini") return "gemini"
  if (raw === "anthropic") return "anthropic"
  return "openai_compatible"
}

function resolveAuthModel(): string {
  // Live: Sonnet for all substantive analysis (extraction, risk, generation). See 2026-09-18 switch from Opus.
  return process.env.AUTH_AI_MODEL ?? "claude-sonnet-5"
}

function resolveAuthFallbackModel(): string {
  // Fallback only on retryable provider failures (timeout/network/rate_limit/provider) — rarely hit, keep Opus for resilience.
  return process.env.AUTH_AI_FALLBACK_MODEL ?? "claude-opus-5"
}

export interface ResolvedSurfaceConfig {
  surface: AISurface
  provider: AIProviderName
  model?: string
  fallbackModel?: string
}

// Single place where surface → provider/model mapping lives.
export function resolveSurfaceConfig(surface: AISurface): ResolvedSurfaceConfig {
  if (surface === "authenticated") {
    const provider = resolveAuthProvider()
    if (provider === "anthropic") {
      return { surface, provider, model: resolveAuthModel(), fallbackModel: resolveAuthFallbackModel() }
    }
    const configured = process.env.AUTH_AI_MODEL
    if (provider === "openai_compatible" && configured !== undefined && !/^[^/\s]+\/[^/\s]+$/.test(configured)) {
      // Fail fast with a diagnosable message: a retired or bare model id
      // 404s every authenticated call (invalid_request, no fallback on this
      // path), which otherwise presents as a total product outage with a
      // generic provider error. Only explicitly-set values are checked —
      // unset falls through to existing adapter defaults.
      throw new Error(
        `AUTH_AI_MODEL must be an exact OpenRouter "provider/model" id (e.g. "anthropic/claude-sonnet-5"); got ${JSON.stringify(configured)}. Fix the environment variable — every authenticated AI call fails until then.`
      )
    }
    return { surface, provider, model: configured }
  }
  // No other surface exists. Callers must use "authenticated".
  return { surface, provider: getActiveProviderName() }
}

async function callWithAdapter(
  provider: AIProviderName,
  params: CallAIParams,
  model?: string
): Promise<ProviderResult> {
  if (provider === "anthropic") {
    return callAnthropicProvider({ ...params, model })
  }
  if (provider === "gemini") {
    return callGeminiProvider({ ...params, model })
  }
  return callOpenAICompatible({ ...params, model })
}

function metaJson(meta: Omit<SurfaceCallMeta, "surface"> & { surface: AISurface }): string {
  return JSON.stringify({
    surface: meta.surface,
    provider: meta.primary.provider,
    model: meta.primary.model,
    fallbackAttempted: meta.fallbackAttempted,
    fallbackModel: meta.fallback?.model ?? null,
    failureCategory: meta.failureCategory ?? null,
    servedByFallback: meta.servedByFallback ?? false,
  })
}

async function callAuthenticatedWithFallback(
  params: CallAIParams,
  model: string,
  fallbackModel: string
): Promise<{ text: string; meta: SurfaceCallMeta }> {
  const primary = { provider: "anthropic", model }
  try {
    const result = await callAnthropicProvider({ ...params, model })
    return {
      text: result.text,
      meta: { surface: "authenticated", primary, fallbackAttempted: false, servedByFallback: false, usage: result.usage },
    }
  } catch (err) {
    const failure = toProviderError(err, "anthropic")
    if (!isFallbackableCategory(failure.category)) {
      // Auth, config, and invalid-request failures would fail identically on
      // the fallback. Do not burn the fallback call; surface the real cause.
      console.error("[auth-ai] primary failed, no fallback for category:", metaJson({
        surface: "authenticated",
        primary,
        fallbackAttempted: false,
        failureCategory: failure.category,
      }))
      throw failure
    }
    console.error("[auth-ai] primary failed, attempting fallback:", metaJson({
      surface: "authenticated",
      primary,
      fallbackAttempted: true,
      fallback: { provider: "anthropic", model: fallbackModel },
      failureCategory: failure.category,
    }))
    try {
      const result = await callAnthropicProvider({ ...params, model: fallbackModel })
      return {
        text: result.text,
        meta: {
          surface: "authenticated",
          primary,
          fallbackAttempted: true,
          fallback: { provider: "anthropic", model: fallbackModel },
          failureCategory: failure.category,
          servedByFallback: true,
          usage: result.usage,
        },
      }
    } catch (fallbackErr) {
      // Do not hide the original failure: the primary error travels as cause.
      const fallbackFailure = toProviderError(fallbackErr, "anthropic")
      console.error("[auth-ai] fallback failed:", metaJson({
        surface: "authenticated",
        primary,
        fallbackAttempted: true,
        fallback: { provider: "anthropic", model: fallbackModel },
        failureCategory: fallbackFailure.category,
      }))
      throw new AIProviderError({
        provider: "anthropic",
        category: fallbackFailure.category,
        status: fallbackFailure.status,
        message: `Authenticated AI unavailable (primary ${failure.category}, fallback ${fallbackFailure.category})`,
        cause: failure,
      })
    }
  }
}

// Surface-aware entry point. Authenticated domain code must use this.
export async function callAIForSurface(
  surface: AISurface,
  params: CallAIParams
): Promise<{ text: string; meta: SurfaceCallMeta }> {
  const config = resolveSurfaceConfig(surface)
  if (surface === "authenticated" && config.provider === "anthropic") {
    return callAuthenticatedWithFallback(params, config.model ?? resolveAuthModel(), config.fallbackModel ?? resolveAuthFallbackModel())
  }
  const result = await callWithAdapter(config.provider, params, config.model).catch((err: unknown) => {
    throw toProviderError(err, config.provider)
  })
  return {
    text: result.text,
    meta: {
      surface,
      primary: { provider: config.provider, model: config.model ?? "(adapter default)" },
      fallbackAttempted: false,
      servedByFallback: false,
      usage: result.usage,
    },
  }
}

export async function callAI(params: CallAIParams): Promise<string> {
  const provider = getActiveProviderName()
  if (provider === "anthropic") {
    return (await callAnthropicProvider(params)).text
  }
  if (provider === "gemini") {
    return (await callGeminiProvider(params)).text
  }
  return (await callOpenAICompatible(params)).text
}
