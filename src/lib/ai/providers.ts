import { callGeminiProvider } from "./providers/gemini"
import { callOpenAICompatible } from "./providers/openai-compatible"

export type AIProviderName = "gemini" | "openai_compatible"

export interface CallAIParams {
  systemPrompt: string
  userContent: string
  temperature?: number
  maxTokens?: number
}

export function getActiveProviderName(): AIProviderName {
  const raw = (process.env.AI_PROVIDER ?? "").trim().toLowerCase()
  if (raw === "gemini") return "gemini"
  if (raw === "openai_compatible" || raw === "openai-compatible" || raw === "openai") return "openai_compatible"
  const baseUrl = process.env.AI_BASE_URL ?? ""
  if (baseUrl.includes("generativelanguage.googleapis.com")) return "gemini"
  const key = process.env.AI_API_KEY ?? process.env.GEMINI_API_KEY ?? ""
  if (key.startsWith("nvapi-") || baseUrl.includes("api.nvidia.com")) return "openai_compatible"
  return "openai_compatible"
}

export async function callAI(params: CallAIParams): Promise<string> {
  const provider = getActiveProviderName()
  if (provider === "gemini") {
    return callGeminiProvider(params)
  }
  return callOpenAICompatible(params)
}
