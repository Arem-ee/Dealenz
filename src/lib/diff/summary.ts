// Material-difference summary for the Compare tab. Pure: diff lines in,
// counts + verdict out. Thresholds are presentation only — the line diff
// stays the source of truth.

import type { DiffLine } from "./lines"

export interface DiffSummary {
  additions: number
  deletions: number
  unchanged: number
  changedPct: number
  verdict: "Identical" | "Minor edits" | "Material differences"
}

export function summarizeDiff(lines: DiffLine[]): DiffSummary {
  let additions = 0
  let deletions = 0
  let unchanged = 0
  for (const l of lines) {
    if (l.type === "add") additions += 1
    else if (l.type === "del") deletions += 1
    else unchanged += 1
  }
  const total = additions + deletions + unchanged
  const changedPct = total === 0 ? 0 : Math.round(((additions + deletions) / total) * 100)
  const verdict = additions === 0 && deletions === 0
    ? "Identical"
    : changedPct < 10
      ? "Minor edits"
      : "Material differences"
  return { additions, deletions, unchanged, changedPct, verdict }
}
