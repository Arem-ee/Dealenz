import { WorkspaceView } from "@/components/workspace/workspace-view"

export const dynamic = "force-dynamic"

// Deal thread: same workspace, scoped to a deal once threads exist.
// Functions land here with the workspace wiring.
export default async function DealWorkspacePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <WorkspaceView />
    </div>
  )
}
