import { cn } from "@/lib/utils"

type Tone = "neutral" | "info" | "success" | "warning" | "error" | "burgundy"

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-foreground",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  error: "bg-destructive/10 text-destructive",
  // Burgundy is reserved for meaningful brand emphasis (e.g. executed seal).
  burgundy: "bg-burgundy/10 text-burgundy",
}

/**
 * Single status badge. Semantic tones map to the token system; never use
 * burgundy as a generic "active" color.
 */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
