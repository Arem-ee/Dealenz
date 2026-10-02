import { notFound } from "next/navigation"
import { ThreadView } from "@/components/workspace/thread-view"
import { getThread } from "@/app/(app)/chat/actions"

export const dynamic = "force-dynamic"

export default async function DealWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getThread(id)
  if (!res.ok) notFound()

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <ThreadView initial={res.thread} />
    </div>
  )
}
