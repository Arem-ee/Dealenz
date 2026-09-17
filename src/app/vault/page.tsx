import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { VaultChat } from "@/components/vault/VaultChat"
import { VaultListFallback } from "@/components/vault/VaultListFallback"

export const dynamic = "force-dynamic"

export default async function VaultPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!user.email_confirmed_at) redirect("/dashboard")

  return (
    <div className="mx-auto max-w-5xl">
      <VaultChat />
      <div className="border-t bg-muted/20">
        <VaultListFallback />
      </div>
    </div>
  )
}
