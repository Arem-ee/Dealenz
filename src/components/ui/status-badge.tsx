import { cn } from "@/lib/utils"

type Tone = "neutral" | "info" | "success" | "warning" | "error"

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-foreground",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  error: "bg-foreground text-background",
}

/**
 * Single status badge. Tones map to the token system: neutral/info/warning
 * render monochrome (ink tints), success keeps the reserved green, and error
 * is solid ink. No chromatic severity colors anywhere.
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
