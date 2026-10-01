import { ApprovalsView } from "@/components/approvals/approvals-view"

export const dynamic = "force-dynamic"

export default async function ApprovalsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <ApprovalsView />
    </div>
  )
}
