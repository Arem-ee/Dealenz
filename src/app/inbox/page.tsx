import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { InboxView } from "@/components/inbox/InboxView"

export const dynamic = "force-dynamic"

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!user.email_confirmed_at) redirect("/dashboard")

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="mx-auto w-full max-w-2xl flex-1 min-h-0 overflow-y-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-[24px] font-bold tracking-tight text-foreground">Inbox</h1>
          <p className="mt-0.5 text-[13px] text-foreground/50">Read Gmail threads here. Import the ones that matter as deals.</p>
        </div>
        <InboxView />
      </div>
    </div>
  )
}
