import { WorkspaceView } from "@/components/workspace/workspace-view"

export const dynamic = "force-dynamic"

// Empty workspace: the intake destination. New deals start here with the
// composer live; the classifier routes from the first keystroke once
// functions land.
export default async function NewWorkspacePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <WorkspaceView />
    </div>
  )
}
