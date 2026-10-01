import { createClient } from "@/lib/supabase/server"
import { listThreads } from "@/lib/chat/actions"
import { DealRepo } from "@/components/home/deal-repo"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = await createClient()
  const [userSettled, threadsSettled] = await Promise.allSettled([
    supabase.auth.getUser(),
    listThreads(),
  ])
  const user = userSettled.status === "fulfilled" ? userSettled.value.data.user : null
  if (!user) return <div />

  let threads: Awaited<ReturnType<typeof listThreads>> = []
  let loadError: string | null = null
  if (threadsSettled.status === "fulfilled") {
    threads = threadsSettled.value
  } else {
    const err = threadsSettled.reason
    loadError = err instanceof Error && err.message ? err.message : "Please refresh and try again."
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background">
      <DealRepo deals={threads} loadError={loadError} />
    </div>
  )
}
