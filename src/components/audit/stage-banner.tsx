import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import type { DealStage } from "@/lib/deal/stage"

/**
 * One obvious deal state + one primary action. Renders above the workspace
 * content on every viewport. Primary actions are anchor links to real
 * in-page sections — never dead buttons, never backend claims.
 */
export function StageBanner({ stage, onPrimaryClick }: { stage: DealStage; onPrimaryClick?: (target: string) => void }) {
  return (
    <div
      className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-surface"
      role="status"
      aria-label={`Deal stage: ${stage.headline}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{stage.headline}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{stage.sub}</p>
        </div>
        {stage.primary && (
          <Button asChild size="sm" className="shrink-0">
            {onPrimaryClick ? (
              <a
                href={stage.primary.target}
                onClick={(e) => {
                  e.preventDefault()
                  onPrimaryClick(stage.primary!.target)
                }}
              >
                {stage.primary.label}
              </a>
            ) : (
              <a href={stage.primary.target}>{stage.primary.label}</a>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

export function DealStateBadge({ status }: { status: string }) {
  const tone =
    status === "failed" ? "error"
    : status === "analyzed" ? "success"
    : status === "processing" ? "info"
    : "neutral"
  return (
    <StatusBadge tone={tone as "error" | "success" | "info" | "neutral"} className="capitalize">
      {status.replace("_", " ")}
    </StatusBadge>
  )
}
