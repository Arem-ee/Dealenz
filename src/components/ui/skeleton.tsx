import { cn } from "@/lib/utils"

/**
 * Skeleton base. Compose layouts that resemble the content about to appear;
 * never use as generic grey rectangles. Respects reduced motion via the
 * global media query (shimmer collapses to a static surface).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-md bg-muted bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.7)_50%,transparent_80%)] bg-[length:200%_100%] animate-shimmer",
        className
      )}
    />
  )
}

/** Dashboard loading shape: greeting + attention rows + recent list. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading your home">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-surface">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-surface">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

/** List loading shape: review queues, deals, purchases. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Loading list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-surface">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

/** Chat loading shape: conversation list + message thread + composer. */
export function ChatSkeleton() {
  return (
    <div className="flex gap-4" role="status" aria-label="Loading conversation">
      <div className="hidden md:block w-56 shrink-0 space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-2/5 rounded-xl" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-24 w-3/5 rounded-xl" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-1/3 rounded-xl" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  )
}export function DetailSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading detail">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-surface">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-surface">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  )
}
