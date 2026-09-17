import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

// The old flagged-deals grid (/deals?flagged=1) was folded into the chat-first
// Home landing (/dashboard) during nav consolidation, so this stub follows it.
// Flagged deals remain visible as threads and in Vault.
export default function RiskIntelligencePage() {
  redirect("/dashboard")
}
