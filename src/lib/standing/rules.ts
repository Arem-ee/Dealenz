// Standing client rules (Harvey-Vault-style universal context).
//
// Pure formatting and bounding: the database layer caps rows, this module
// caps prompt cost. Rules arrive oldest-first; overflow drops the newest,
// so foundational rules survive. Empty input yields null (absent stays
// absent): callers omit the block rather than sending an empty header the
// model might hallucinate under.

export const MAX_STANDING_RULES = 20
export const MAX_RULE_CHARS = 300
export const STANDING_BLOCK_BUDGET_CHARS = 2000

export function formatStandingBlock(rules: string[]): string | null {
  const clean = rules
    .map((r) => (typeof r === "string" ? r.trim() : ""))
    .filter((r) => r.length > 0)
    .slice(0, MAX_STANDING_RULES)
  if (clean.length === 0) return null
  const lines: string[] = []
  let used = 0
  for (const rule of clean) {
    const line = `- ${rule.slice(0, MAX_RULE_CHARS)}`
    if (used + line.length + 1 > STANDING_BLOCK_BUDGET_CHARS && lines.length > 0) break
    lines.push(line)
    used += line.length + 1
  }
  if (lines.length === 0) return null
  return `Standing client rules (apply to this deal alongside the task above):\n${lines.join("\n")}`
}
