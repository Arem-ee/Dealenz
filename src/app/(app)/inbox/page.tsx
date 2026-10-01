import { InboxView } from "@/components/inbox/inbox-view"

export const dynamic = "force-dynamic"

export default async function InboxPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <InboxView />
    </div>
  )
}
