import { redirect } from "next/navigation"
import { AskClient } from "@/components/ask/ask-client"
import { getAskContext } from "./actions"

export const dynamic = "force-dynamic"

export default async function AskPage() {
  let context: { balance: number | null; audits: Array<{ id: string; title: string; status: string }> }
  try {
    context = await getAskContext()
  } catch (err) {
    redirect(err instanceof Error && err.message === "VERIFY_REQUIRED" ? "/dashboard" : "/login")
  }
  return <AskClient initialBalance={context.balance} audits={context.audits} />
}
