import { createClient } from "@/lib/supabase/server"
import { listThreads } from "@/lib/chat/actions"
import { ChatLanding } from "@/components/chat/ChatLanding"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div />

  const threads = await listThreads().catch(() => [])

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-background">
      <ChatLanding threads={threads} />
    </div>
  )
}
