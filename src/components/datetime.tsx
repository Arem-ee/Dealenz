"use client"

import { useSyncExternalStore } from "react"
import { formatClock, formatDateTime, formatDayShort } from "@/lib/format-time"

type Kind = "time" | "day" | "datetime"

const formatters = {
  time: formatClock,
  day: formatDayShort,
  datetime: formatDateTime,
} as const

/**
 * Hydration-safe timestamp. Server and first client render emit the stable
 * ISO date slice (identical bytes, no clock involved); the localized
 * wall-clock text renders after mount. Without this, server-UTC vs
 * browser-local formatting mismatches fail hydration (React #418) on every
 * message, comment, signature, and version timestamp.
 */
export function ClientTime({
  iso,
  kind = "time",
  className,
}: {
  iso: string | null | undefined
  kind?: Kind
  className?: string
}) {
  // Client-only after hydration: server and first client render emit the
  // stable ISO date slice (identical bytes, no clock involved). No effect,
  // no cascading render — the snapshot differs by environment by design.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  if (!iso) return null
  if (!mounted) {
    return (
      <span className={className} suppressHydrationWarning>
        {iso.slice(0, 10)}
      </span>
    )
  }
  return (
    <time dateTime={iso} className={className}>
      {formatters[kind](new Date(iso))}
    </time>
  )
}
