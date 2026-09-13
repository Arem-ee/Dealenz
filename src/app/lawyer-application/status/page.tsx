import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import LawyerApplicationStatus from "./status-client"

export const dynamic = "force-dynamic"

export default async function LawyerApplicationStatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/lawyer-application/status")
  return <LawyerApplicationStatus />
}
