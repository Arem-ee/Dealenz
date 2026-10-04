// Report statistics — pure. Medians over timestamp pairs, day buckets,
// and CSV rendering. No I/O; the actions layer fetches, these compute.

/** Median of numbers; null when empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Whole days between two timestamps; null when unparseable or negative. */
export function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (Number.isNaN(ms) || ms < 0) return null
  return Math.floor(ms / 86_400_000)
}

/** Median days across [from,to] pairs that both parse. */
export function medianDays(pairs: Array<{ from: string | null; to: string | null }>): { median: number | null; n: number } {
  const ds = pairs
    .map((p) => daysBetween(p.from, p.to))
    .filter((d): d is number => d !== null)
  return { median: median(ds), n: ds.length }
}

export function dayKey(iso: string): string | null {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString().slice(0, 10)
}

/** Counts per day over trailing days (oldest first), zero-filled. */
export function dailyCounts(stamps: string[], days = 30, now: number = Date.now()): Array<{ day: string; count: number }> {
  const out: Array<{ day: string; count: number }> = []
  for (let i = days - 1; i >= 0; i--) {
    out.push({ day: new Date(now - i * 86_400_000).toISOString().slice(0, 10), count: 0 })
  }
  const byDay = new Map(out.map((d) => [d.day, d]))
  for (const s of stamps) {
    const k = dayKey(s)
    const slot = k ? byDay.get(k) : undefined
    if (slot) slot.count += 1
  }
  return out
}

export function formatDays(d: number | null): string {
  if (d === null) return "—"
  if (d === 0) return "<1 day"
  return `${d} day${d === 1 ? "" : "s"}`
}

/** Counts per calendar month over trailing months (oldest first), zero-filled. Labels as YYYY-MM. */
export function monthBuckets(stamps: string[], months = 12, now: number = Date.now()): Array<{ month: string; count: number }> {
  const nowDate = new Date(now)
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  const out = keys.map((month) => ({ month, count: 0 }))
  const byMonth = new Map(out.map((m) => [m.month, m]))
  for (const s of stamps) {
    const t = new Date(s).getTime()
    if (Number.isNaN(t)) continue
    const d = new Date(t)
    const slot = byMonth.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    if (slot) slot.count += 1
  }
  return out
}

/** Minimal CSV: header + rows, quoted when needed. */
export function toCsv(header: string[], rows: string[][]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\n")
}
