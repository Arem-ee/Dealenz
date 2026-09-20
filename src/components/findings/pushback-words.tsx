"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

// Per-finding counter-language: the exact words the user can send to the
// counterparty about this finding. Deterministic rule data (never
// AI-generated), rendered only when the finding carries it — absent stays
// absent. Copy-first: the job is "what to push back on, in what words",
// and the words need to leave this screen into an email or redline.
export function PushbackWords({ words, compact }: { words: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(words)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (permissions, insecure context): the text
      // stays visible and selectable, so nothing is lost.
    }
  }

  return (
    <div className={compact ? "mt-1.5 rounded-lg bg-muted/40 px-2.5 py-2" : "mt-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5"}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Words to send</p>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Copy the words to send"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1 font-serif text-xs leading-relaxed">&ldquo;{words}&rdquo;</p>
    </div>
  )
}
