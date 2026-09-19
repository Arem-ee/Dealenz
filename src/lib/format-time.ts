// Deterministic wall-clock formatting for user-facing timestamps.
//
// Server (UTC) and browser (user timezone) clocks differ, so formatting dates
// during render guarantees hydration mismatches. These pure formatters always
// run client-side only (see <ClientTime />) with a pinned locale — never rely
// on the runtime default. Invalid input renders as "" (absent), never throws.

export function formatClock(d: Date): string {
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

export function formatDayShort(d: Date): string {
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function formatDateTime(d: Date): string {
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
