// Schedule due-check — pure cadence math for report digests.
//
// Weekly fires on its weekday, monthly on the 1st, at the schedule's hour
// in its explicit timezone (never implicit UTC). A schedule with a
// last_run_at inside the current period is not due again. Expired or
// inactive schedules never fire — expiry pauses, it never deletes.

export interface DueSchedule {
  cadence: "weekly" | "monthly"
  timezone: string
  sendHour: number
  sendWeekday: number | null
  active: boolean
  expiresAt: string | null
  lastRunAt: string | null
}

function partsInZone(date: Date, timeZone: string): { weekday: number; day: number; hour: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      day: "numeric",
      hour: "numeric",
      hour12: false,
    })
    const parts = fmt.formatToParts(date)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    const weekday = weekdayMap[get("weekday")] ?? -1
    const day = parseInt(get("day"), 10)
    let hour = parseInt(get("hour"), 10)
    if (hour === 24) hour = 0
    if (weekday < 0 || !Number.isFinite(day) || !Number.isFinite(hour)) return null
    return { weekday, day, hour }
  } catch {
    return null
  }
}

/** True when the schedule should execute at `now`. */
export function isScheduleDue(schedule: DueSchedule, now: Date = new Date()): boolean {
  if (!schedule.active) return false
  if (schedule.expiresAt && new Date(schedule.expiresAt).getTime() <= now.getTime()) return false
  const parts = partsInZone(now, schedule.timezone)
  if (!parts) return false
  if (parts.hour !== schedule.sendHour) return false
  if (schedule.cadence === "weekly") {
    if (schedule.sendWeekday === null || parts.weekday !== schedule.sendWeekday) return false
    if (schedule.lastRunAt) {
      const days = (now.getTime() - new Date(schedule.lastRunAt).getTime()) / 86_400_000
      if (days < 6) return false
    }
    return true
  }
  // Monthly: the 1st, once per 28+ days.
  if (parts.day !== 1) return false
  if (schedule.lastRunAt) {
    const days = (now.getTime() - new Date(schedule.lastRunAt).getTime()) / 86_400_000
    if (days < 28) return false
  }
  return true
}

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
]

/** Timezone allowlist for schedule creation (IANA, curated). */
export function isSupportedTimezone(raw: unknown): raw is string {
  return typeof raw === "string" && (COMMON_TIMEZONES as readonly string[]).includes(raw)
}

export function supportedTimezones(): string[] {
  return [...COMMON_TIMEZONES]
}
