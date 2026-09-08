import { redirect } from "next/navigation"
import { AskClient } from "@/components/ask/ask-client"
import { getAskContext } from "./actions"

export const dynamic = "force-dynamic"

export default async function AskPage({
  searchParams,
}: {
  searchParams?: Promise<{ conversation?: string; deal?: string }>
}) {
  let context: Awaited<ReturnType<typeof getAskContext>>
  try {
    context = await getAskContext()
  } catch (err) {
    redirect(err instanceof Error && err.message === "VERIFY_REQUIRED" ? "/dashboard" : "/login")
  }
  const params = (await searchParams) ?? {}
  const requestedId = params.conversation ?? null
  const requestedDeal = params.deal ?? null
  const initialConversationId =
    requestedId && context.conversations.some((conversation) => conversation.id === requestedId)
      ? requestedId
      : null
  const initialAuditId =
    requestedDeal && context.audits.some((a) => a.id === requestedDeal) ? requestedDeal : null
  return (
    <AskClient
      initialBalance={context.balance}
      audits={context.audits}
      initialConversations={context.conversations}
      initialConversationId={initialConversationId}
      initialAuditId={initialAuditId}
    />
  )
}
