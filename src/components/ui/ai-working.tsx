"use client"

import { cn } from "@/lib/utils"

/**
 * Minimum presentation is implemented at the call site (record start time,
 * wait the remainder of ~900ms before clearing the working flag) so the
 * indicator below never flashes working→done. The delay is an
 * interaction-design decision, not a processing claim: small, fixed, and
 * never gating real results beyond the indicator itself.
 */

/**
 * Single reusable AI working pattern: calm status text + animated dots.
 * Wording must reflect the real operation (Analyzing, Generating, …).
 * Screen readers get a polite live status, not dot chatter.
 */
export function AiWorking({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 text-sm text-muted-foreground", className)}>
      <span role="status" aria-live="polite">
        {label}
      </span>
      <span aria-hidden="true" className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-current animate-ai-dots"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </span>
    </div>
  )
}
