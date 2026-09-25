import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LibraryView } from "@/components/library/LibraryView"

export const dynamic = "force-dynamic"

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!user.email_confirmed_at) redirect("/dashboard")

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background">
      <LibraryView />
    </div>
  )
}
