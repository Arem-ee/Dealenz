// Unified input classifier — single source of truth for every entry point.
// Wraps src/lib/conversation/classify.ts classifyOperation + isGreeting so no
// component re-implements its own heuristic (the "hello → full deal" bug).

import { classifyOperation, isGreeting } from "@/lib/conversation/classify"
import type { AIOperation } from "@/lib/ai/operations"

export type InputOutcome = "greeting" | "question" | "deal" | "action"

export function classifyInput(text: string, hasDocument: boolean): { outcome: InputOutcome; operation: AIOperation } {
  if (hasDocument) {
    return { outcome: "deal", operation: "document_analysis" }
  }
  if (isGreeting(text)) {
    return { outcome: "greeting", operation: "conversation" }
  }
  const op = classifyOperation(text, hasDocument)
  if (op === "document_analysis" || op === "proposal") {
    return { outcome: "deal", operation: op }
  }
  if (op === "conversation" && text.trim().length > 200) {
    return { outcome: "deal", operation: op }
  }
  if (op === "drafting" || op === "negotiation" || op === "comparison" || op === "decision_support" || op === "explanation") {
    // Without a document, treat as question unless explicitly deal-like text
    // For now, questions go to Ask pipeline; explicit actions (later phases) will be "action"
    // Detect explicit action phrases for future phases
    if (/\b(generate.*proposal|get.*lawyer|review this|sign)\b/i.test(text)) {
      return { outcome: "action", operation: op }
    }
    return { outcome: "question", operation: op }
  }
  return { outcome: "question", operation: op }
}
