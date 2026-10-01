import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Home. The old dashboard (deal list) was deleted entirely — this page
 * carries no list, no search, no rows. What Home becomes is decided
 * in the tab-by-tab rebuild.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Home</h1>
        </div>
        <Link
          href="/audit/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-none bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New deal
        </Link>
      </div>
    </div>
  )
}
