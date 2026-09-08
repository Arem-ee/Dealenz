// Pure operation classification (client-safe).
//
// No server imports, no ledger, no AI. Used by both the conversation
// pipeline and the Ask UI's cost estimate. Keep this file free of
// "server-only" dependencies so client components can import it.

import {
  resolveOperationProfile,
  type AIOperation,
  type UserIntent,
} from "@/lib/ai/operations"

export const DETERMINISTIC_GREETING = "Hello. What are you working on?"

export function isGreeting(text: string): boolean {
  const t = text.toLowerCase().trim()
  return /^(hi|hey|hello|yo|thanks|thank you|ok|okay|bye)\b/.test(t) && t.length < 30
}

const has = (text: string, pattern: RegExp): boolean => pattern.test(text)

export function classifyOperation(text: string, hasDocument: boolean): AIOperation {
  if (isGreeting(text)) return "conversation"
  const t = text.toLowerCase().trim()
  if (/negotiat|push back|counter(-|\s*)offer|ask for more|lower the|raise the|how should i respond|how to respond/.test(t)) return "negotiation"
  if (/compar|which (one|offer)|better deal|better offer|two offers/.test(t)) return "comparison"
  if (/\b(draft|write|word|respond|reply|email|letter|redline|suggest (a |the )?clause|safer version)\b/.test(t)) return "drafting"
  if (/should i (accept|sign|agree|take|walk away)|worth it|good deal|bad deal|decide|make sense for me/.test(t)) return "decision_support"
  if (/what does|what is|what do you mean|explain|mean by|define|net 30|how does .* work/.test(t)) return "explanation"
  if (/review|analy[sz]e|biggest problem|risk|audit|look (at|over)|check this|problem/.test(t)) {
    return "document_analysis"
  }
  void hasDocument
  return "conversation"
}

export function inferIntent(text: string, operation: AIOperation): UserIntent {
  const t = text.toLowerCase()
  if (operation === "negotiation") return "negotiate"
  if (operation === "drafting") return "draft"
  if (operation === "comparison") return "compare"
  if (operation === "decision_support") return "decide"
  if (operation === "document_analysis") return "review"
  if (operation === "explanation" || has(t, /what does|what is|explain|mean by/)) return "understand"
  if (has(t, /should i|decide|worth it/)) return "decide"
  if (has(t, /negotiat/)) return "negotiate"
  return "explore"
}
