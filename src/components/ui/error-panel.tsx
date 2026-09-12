"use client"

import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Contextual error panel: what happened, what it means, what to do.
 * Never renders raw provider/database errors — callers pass curated copy
 * and only claims the backend supports (e.g. charge state).
 */
export function ErrorPanel({
  title,
  body,
  chargeNote,
  retryLabel = "Try again",
  onRetry,
  retryHref,
  className,
}: {
  title: string
  body: string
  /** Only pass when the backend guarantees it (reserve/void paths do). */
  chargeNote?: string
  retryLabel?: string
  onRetry?: () => void
  /** Link retry for server-component callers (no function prop needed). */
  retryHref?: string
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/25 bg-destructive/[0.04] px-5 py-4 shadow-surface",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
          {chargeNote && <p className="mt-1.5 text-sm font-medium text-foreground">{chargeNote}</p>}
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-3">
              {retryLabel}
            </Button>
          )}
          {!onRetry && retryHref && (
            <Button variant="outline" size="sm" asChild className="mt-3">
              <a href={retryHref}>{retryLabel}</a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
