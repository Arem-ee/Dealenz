export type DiffLine = { type: "same" | "add" | "del"; text: string }

const MAX_LINES_EACH = 500

export function diffLines(oldText: string, newText: string): DiffLine[] | null {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  if (oldLines.length > MAX_LINES_EACH || newLines.length > MAX_LINES_EACH) return null
  const n = oldLines.length
  const m = newLines.length
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = oldLines[i] === newLines[j] ? (dp[i + 1]![j + 1]! + 1) : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      out.push({ type: "same", text: oldLines[i]! })
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ type: "del", text: oldLines[i]! })
      i++
    } else {
      out.push({ type: "add", text: newLines[j]! })
      j++
    }
  }
  while (i < n) out.push({ type: "del", text: oldLines[i++]! })
  while (j < m) out.push({ type: "add", text: newLines[j++]! })
  return out
}
