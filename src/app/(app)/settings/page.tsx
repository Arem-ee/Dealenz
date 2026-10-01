import { createClient } from "@/lib/supabase/server"
import { SettingsView } from "@/components/settings/settings-view"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div />

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <SettingsView email={user.email ?? ""} />
    </div>
  )
}
