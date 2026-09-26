import { callAI as callAIImpl, callAIForSurface, callAISurfaceStream, getActiveProviderName } from "./providers"
import type { AISurface, SurfaceCallMeta } from "./providers"

export type { AISurface, SurfaceCallMeta }

export interface CallAIOptions {
  systemPrompt: string
  userContent: string
  temperature?: number
  maxTokens?: number
}

// Legacy shared path (retained for internal fallback; authenticated domain code
// must use callAIForSurface with an explicit surface).
export async function callAI(params: CallAIOptions): Promise<string> {
  return callAIImpl({
    systemPrompt: params.systemPrompt,
    userContent: params.userContent,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
  })
}

// Surface-aware entry point. Returns provider/fallback metadata alongside the
// text so callers can keep usedFallback accurate and logging can record which
// provider and model served each call without logging prompts or responses.
export async function callAISurface(
  surface: AISurface,
  params: CallAIOptions
): Promise<{ text: string; meta: SurfaceCallMeta }> {
  return callAIForSurface(surface, {
    systemPrompt: params.systemPrompt,
    userContent: params.userContent,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
  })
}

// Streaming variant: emits provider tokens via onToken when the resolved
// surface provider supports it, otherwise serves buffered with zero tokens.
// Identical output contract to callAISurface plus a streamed flag.
export async function callAISurfaceStreaming(
  surface: AISurface,
  params: CallAIOptions,
  onToken: (delta: string) => void
): Promise<{ text: string; meta: SurfaceCallMeta; streamed: boolean }> {
  return callAISurfaceStream(
    surface,
    {
      systemPrompt: params.systemPrompt,
      userContent: params.userContent,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    },
    onToken
  )
}

export function getActiveProvider(): string {
  return getActiveProviderName()
}

export async function callGemini(
  systemPrompt: string,
  userContent: string,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  return callAI({
    systemPrompt,
    userContent,
    temperature: options?.temperature,
    maxTokens: options?.maxOutputTokens,
  })
}
