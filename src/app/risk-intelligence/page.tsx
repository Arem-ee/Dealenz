import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default function RiskIntelligencePage() {
  redirect("/deals?flagged=1")
}
