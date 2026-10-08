// Prompt template variables — pure helpers for the Prompt Lab.
//
// Syntax is {{name}}, matching the clause-template convention
// (src/lib/documents + src/lib/clauses/tracking.ts). Names are
// [A-Za-z0-9_], 1–64 chars. Rendering is strict: missing values fail
// closed with the missing list instead of silently sending blanks.

const VARIABLE_RE = /\{\{([A-Za-z0-9_]{1,64})\}\}/g

/** Distinct variable names in template order of first appearance. */
export function extractPromptVariables(template: string): string[] {
  if (typeof template !== "string" || template.length === 0) return []
  const seen = new Set<string>()
  for (const m of template.matchAll(VARIABLE_RE)) {
    const name = m[1]
    if (name && !seen.has(name)) seen.add(name)
  }
  return [...seen]
}

export type RenderResult =
  | { ok: true; text: string }
  | { ok: false; missing: string[] }

/** Renders {{vars}} or fails closed listing every missing variable. */
export function renderPromptTemplate(
  template: string,
  values: Record<string, string>
): RenderResult {
  const needed = extractPromptVariables(template)
  const missing = needed.filter((n) => {
    const v = values[n]
    return typeof v !== "string" || v.trim().length === 0
  })
  if (missing.length > 0) return { ok: false, missing }
  const text = template.replace(VARIABLE_RE, (_, name: string) => values[name]!.trim())
  return { ok: true, text }
}

export const MAX_PROMPT_NAME = 80
export const MAX_PROMPT_DESCRIPTION = 500
export const MAX_SYSTEM_TEXT = 8000
export const MAX_USER_TEMPLATE = 12000
export const MAX_COMMIT_MESSAGE = 280
export const MAX_EVAL_NOTE = 1000

export function normalizePromptName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const name = raw.trim().slice(0, MAX_PROMPT_NAME)
  return name.length > 0 ? name : null
}
