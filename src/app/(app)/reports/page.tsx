import { ReportsView } from "@/components/reports/reports-view"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <ReportsView />
    </div>
  )
}
