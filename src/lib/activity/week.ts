// Weekly activity buckets for the home rhythm strip: event counts per
// day over the trailing 7 days, today highlighted. Pure and defensive —
// malformed rows are skipped, never counted.

export interface DayBucket {
  key: string
  label: string
  count: number
  isToday: boolean
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function bucketActivityByDay(
  events: Array<{ created_at?: unknown } | null | undefined>,
  nowIso: string
): DayBucket[] {
  const now = new Date(nowIso)
  if (Number.isNaN(now.getTime())) return []
  const todayKey = nowIso.slice(0, 10)
  const buckets: DayBucket[] = []
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - offset)
    const key = d.toISOString().slice(0, 10)
    buckets.push({
      key,
      label: offset === 0 ? "Today" : DAY_LABELS[d.getUTCDay()] ?? key,
      count: 0,
      isToday: key === todayKey,
    })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const e of events ?? []) {
    const created = e && typeof e.created_at === "string" ? e.created_at.slice(0, 10) : ""
    const bucket = byKey.get(created)
    if (bucket) bucket.count += 1
  }
  return buckets
}
