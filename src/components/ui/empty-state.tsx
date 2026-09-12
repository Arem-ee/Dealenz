import type { ComponentType, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Designed empty state: what is empty, why, and the single next action.
 * No decorative illustrations.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  actionHref,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center shadow-surface",
        className
      )}
    >
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {actionLabel && (onAction || actionHref) && (
        <div className="mt-5">
          {actionHref ? (
            <Button asChild>
              <a href={actionHref}>{actionLabel}</a>
            </Button>
          ) : (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Slim inline empty row for already-framed sections (activity, comments). */
export function EmptyRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("rounded-lg bg-muted/60 px-4 py-3 text-center text-sm text-muted-foreground", className)}>
      {children}
    </p>
  )
}
