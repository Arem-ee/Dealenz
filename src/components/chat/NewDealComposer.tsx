"use client"

import { useState } from "react"
import { Composer } from "@/components/chat/Composer"
import { clearPendingDeal, getPendingDeal } from "@/lib/pending-deal"

// New-deal entry: anonymous landing input resumes here prefilled after
// signup, cleared on first send. Without pending text this is a clean
// composer over the deal pipeline.
export function NewDealComposer() {
  const [pendingPrefill] = useState<{ text: string; key: number } | null>(() => {
    const pending = getPendingDeal()
    if (!pending) return null
    return { text: pending, key: Date.now() }
  })

  return (
    <Composer
      prefill={pendingPrefill}
      onMessageSent={() => {
        if (pendingPrefill) clearPendingDeal()
      }}
    />
  )
}
