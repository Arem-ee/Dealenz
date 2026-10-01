import { TemplatesView } from "@/components/templates/templates-view"

export const dynamic = "force-dynamic"

export default async function TemplatesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <TemplatesView />
    </div>
  )
}
