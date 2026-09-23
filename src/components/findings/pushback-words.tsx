"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

// Per-finding counter-language: the exact words the user can send to the
// counterparty about this finding. Deterministic rule data (never
// AI-generated), rendered only when the finding carries it — absent stays
// absent. Copy-first: the job is "what to push back on, in what words",
// and the words need to leave this screen into an email or redline.
// Successful copies are logged (rule + deal linkage, never content) as
// outcome-data flywheel input when identity is available.
export function PushbackWords({ words, compact, auditId, ruleKey }: { words: string; compact?: boolean; auditId?: string | null; ruleKey?: string | null }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(words)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      if (auditId && ruleKey) {
        const { logPushbackCopy } = await import("@/lib/findings/actions")
        await logPushbackCopy({ auditId, ruleKey }).catch(() => null)
      }
    } catch {
      // Clipboard unavailable (permissions, insecure context): the text
      // stays visible and selectable, so nothing is lost.
    }
  }

  return (
    <p className={compact ? "mt-1.5 text-xs leading-relaxed text-muted-foreground" : "mt-2 text-xs leading-relaxed text-muted-foreground"}>
      &ldquo;{words}&rdquo;{" "}
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        aria-label="Copy the words to send"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </p>
  )
}
