import { TrackerView } from "@/components/tracker/tracker-view"

export const dynamic = "force-dynamic"

export default async function TrackerPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <TrackerView />
    </div>
  )
}
