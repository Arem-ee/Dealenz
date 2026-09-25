import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import SettingsClient from "@/components/settings-client"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle()
  const initialProfile = profile as Record<string, unknown> | null
  const email = user.email ?? ""
  const googleConnected = Array.isArray(user.identities) && user.identities.some((i) => i.provider === "google")
  let gmailConnected = false
  try {
    const { getGmailTokens } = await import("@/lib/gmail/tokens")
    gmailConnected = (await getGmailTokens(supabase as never, user.id).catch(() => null)) !== null
  } catch {
    gmailConnected = false
  }
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <SettingsClient initialProfile={initialProfile} email={email} googleConnected={googleConnected} gmailConnected={gmailConnected} />
    </div>
  )
}
