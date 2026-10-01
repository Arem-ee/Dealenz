import { LabView } from "@/components/lab/lab-view"

export const dynamic = "force-dynamic"

export default async function LabPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <LabView />
    </div>
  )
}
