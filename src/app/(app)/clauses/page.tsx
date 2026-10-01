import { ClausesView } from "@/components/clauses/clauses-view"

export const dynamic = "force-dynamic"

export default async function ClausesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <ClausesView />
    </div>
  )
}
