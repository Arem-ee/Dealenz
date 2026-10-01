import { DraftsView } from "@/components/drafts/drafts-view"

export const dynamic = "force-dynamic"

export default async function DraftsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DraftsView />
    </div>
  )
}
