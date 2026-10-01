import { TeamView } from "@/components/team/team-view"

export const dynamic = "force-dynamic"

export default async function TeamPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <TeamView />
    </div>
  )
}
