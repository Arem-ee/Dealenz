import { callAnthropicProvider } from "@/lib/ai/providers/anthropic"
import { callGeminiProvider } from "@/lib/ai/providers/gemini"
import { callOpenAICompatible } from "@/lib/ai/providers/openai-compatible"
import type { ProviderResult } from "@/lib/ai/operations"

// Runs one provider call against a user-held key (BYOK). The plaintext key
// lives only in this call's arguments: decrypted for resolution, passed
// to the adapter, discarded when the call settles. It is never persisted,
// never logged, never leaves the server boundary except to the provider.
export type ByokProvider = "anthropic" | "openai_compatible" | "gemini"

export interface ByokCall {
  provider: ByokProvider
  apiKey: string
  model: string
  baseUrl?: string | null
  systemPrompt: string
  userContent: string
  temperature?: number
  maxTokens?: number
}

export interface ByokResult {
  text: string
  provider: ByokProvider
  model: string
  usage?: ProviderResult["usage"]
}

export async function runWithUserKey(call: ByokCall): Promise<ByokResult> {
  const { provider, apiKey, model, systemPrompt, userContent, temperature, maxTokens } = call
  if (!apiKey) throw new Error("No provider key was provided for this call.")
  if (!model.trim()) throw new Error("No model was selected for this call.")

  if (provider === "anthropic") {
    const res = await callAnthropicProvider({ systemPrompt, userContent, temperature, maxTokens, model, apiKey })
    return { text: res.text, provider, model, usage: res.usage }
  }
  if (provider === "gemini") {
    const res = await callGeminiProvider({ systemPrompt, userContent, temperature, maxTokens, model, apiKey })
    return { text: res.text, provider, model, usage: res.usage }
  }
  const res = await callOpenAICompatible({
    systemPrompt,
    userContent,
    temperature,
    maxTokens,
    model,
    apiKey,
    baseUrl: call.baseUrl?.trim() ? call.baseUrl.trim() : "https://api.openai.com/v1",
  })
  return { text: res.text, provider, model, usage: res.usage }
}
