import { callAI as callAIImpl, getActiveProviderName } from "./providers"

export interface CallAIOptions {
  systemPrompt: string
  userContent: string
  temperature?: number
  maxTokens?: number
}

export async function callAI(params: CallAIOptions): Promise<string> {
  return callAIImpl({
    systemPrompt: params.systemPrompt,
    userContent: params.userContent,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
  })
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
