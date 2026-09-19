import { createClient } from "@/lib/supabase/server"
import { listThreads } from "@/lib/chat/actions"
import { ChatLanding } from "@/components/chat/ChatLanding"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div />

  // Surface load failures honestly in the landing instead of pretending the
  // user has no threads.
  let threads: Awaited<ReturnType<typeof listThreads>> = []
  let loadError: string | null = null
  try {
    threads = await listThreads()
  } catch (err) {
    loadError = err instanceof Error && err.message ? err.message : "Please refresh and try again."
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col bg-background md:h-dvh">
      <ChatLanding threads={threads} loadError={loadError} />
    </div>
  )
}
