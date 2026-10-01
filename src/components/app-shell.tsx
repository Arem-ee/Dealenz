import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TopBar } from "@/components/top-bar"
import { Sidebar } from "@/components/sidebar"

export const dynamic = "force-dynamic"

async function getCreditBalance(userId: string): Promise<number | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return null
  try {
    const { data } = await supabase.rpc("credit_balance" as never)
    if (Array.isArray(data)) {
      const first = (data as Array<{ balance?: unknown }>)[0]
      return typeof first?.balance === "number" ? first.balance : null
    }
    if (data && typeof data === "object" && "balance" in (data as Record<string, unknown>)) {
      const balance = (data as Record<string, unknown>).balance
      return typeof balance === "number" ? balance : null
    }
    if (typeof data === "number") return data
    return null
  } catch {
    return null
  }
}

// App shell: pinned top bar, fixed sidebar, page below. Auth-gated —
// signed-out visitors go to login, unverified accounts see a notice.
export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  if (!user.email_confirmed_at) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md border border-border bg-background p-6 text-center">
          <p className="text-base font-semibold">Verify your email</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check your inbox at <strong>{user.email}</strong> and click the verification link, then sign in again.
          </p>
        </div>
      </div>
    )
  }

  const email = user.email ?? ""
  const [{ data: profile }, creditBalance, { data: audits }] = await Promise.all([
    supabase.from("business_profiles").select("business_name").eq("user_id", user.id).maybeSingle(),
    getCreditBalance(user.id),
    supabase.from("audits").select("id, title, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50),
  ])
  const businessName = (profile as { business_name?: string | null } | null)?.business_name ?? null
  const threads = ((audits ?? []) as Array<{ id: string; title: string | null; updated_at: string }>).map((a) => ({
    id: a.id,
    title: a.title ?? "Untitled",
    updatedAt: a.updated_at,
  }))

  return (
    <div className="flex h-dvh flex-col bg-background">
      <TopBar email={email} businessName={businessName} creditBalance={creditBalance} threads={threads} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </main>
      </div>
    </div>
  )
}
