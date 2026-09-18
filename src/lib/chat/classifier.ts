// Unified input classifier — single source of truth for every entry point.
// Wraps src/lib/conversation/classify.ts classifyOperation + isGreeting so no
// component re-implements its own heuristic (the "hello → full deal" bug).

import { classifyOperation, isGreeting } from "@/lib/conversation/classify"
import type { AIOperation } from "@/lib/ai/operations"

export type InputOutcome = "greeting" | "question" | "deal" | "action"

// Explicit in-chat actions. Kept tight on purpose: phrases like "review
// this" or "sign" usually mean "analyze my deal", which is the deal path —
// only unambiguous commands ("generate a proposal", "get a lawyer") route
// to the in-chat action handlers.
const EXPLICIT_ACTION_RE =
  /\b(generate|create|prepare|write)\s+(a\s+|this\s+|that\s+|the\s+)?proposal\b|\b(get|need|want|have)\s+(a\s+)?(lawyer|attorney)\b|\blawyer\s+review\b/i

export function classifyInput(text: string, hasDocument: boolean): { outcome: InputOutcome; operation: AIOperation } {
  if (hasDocument) {
    return { outcome: "deal", operation: "document_analysis" }
  }
  if (isGreeting(text)) {
    return { outcome: "greeting", operation: "conversation" }
  }
  const op = classifyOperation(text, hasDocument)
  if (EXPLICIT_ACTION_RE.test(text)) {
    return { outcome: "action", operation: op }
  }
  if (op === "document_analysis" || op === "proposal") {
    return { outcome: "deal", operation: op }
  }
  if (op === "conversation" && text.trim().length > 200) {
    return { outcome: "deal", operation: op }
  }
  if (op === "drafting" || op === "negotiation" || op === "comparison" || op === "decision_support" || op === "explanation") {
    return { outcome: "question", operation: op }
  }
  return { outcome: "question", operation: op }
}
