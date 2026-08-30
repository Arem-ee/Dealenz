import { Scale } from "lucide-react"
import { cn } from "@/lib/utils"

interface LegalDisclaimerProps {
  className?: string
  compact?: boolean
}

const DISCLAIMER_TEXT =
  "Dealenz generates AI-assisted recommendations and document drafts. These are not legal services or legal advice. Review important agreements with a qualified professional."

export function LegalDisclaimer({ className, compact }: LegalDisclaimerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-muted bg-muted/20 p-4",
        compact && "p-3",
        className
      )}
    >
      <Scale className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <p className={cn("text-xs leading-relaxed text-muted-foreground", compact && "text-[11px]")}>
        {DISCLAIMER_TEXT}
      </p>
    </div>
  )
}

export const DISCLAIMER_PDF_TEXT = DISCLAIMER_TEXT
