import { Suspense } from "react"
import { redirect } from "next/navigation"
import { MailQuestion, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ResendVerificationButton } from "@/components/resend-verification-button"
import { getCreditBalanceForHome } from "@/app/dashboard/actions"
import { VerificationBanner } from "@/components/verification-banner"
import { listThreads } from "@/lib/chat/actions"
import { ChromeShell } from "@/components/app-shell-client"
import type { SidebarThread } from "@/lib/nav"

async function getShellData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (!user.email_confirmed_at) {
    return { user, emailConfirmed: false }
  }

  const email = user.email ?? ""

  const { data: businessProfile } = await supabase
    .from("business_profiles")
    .select("business_name")
    .eq("user_id", user.id)
    .maybeSingle()

  const businessName = (businessProfile as { business_name: string | null } | null)?.business_name ?? null

  const { data: lawyerRow } = await supabase
    .from("lawyers")
    .select("id")
    .eq("user_id", user.id)
    .eq("verification_status", "verified")
    .maybeSingle()
  const isLawyer = lawyerRow !== null

  const creditBalance = await getCreditBalanceForHome()

  let threads: SidebarThread[] = []
  let openIssues = 0
  try {
    const rows = await listThreads()
    threads = rows.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, status: t.status ?? null, riskLevel: t.riskLevel ?? null }))
    openIssues = rows.reduce((s, t) => s + (typeof t.openIssues === "number" ? t.openIssues : 0), 0)
  } catch {
    threads = []
  }

  return { user, emailConfirmed: true, email, businessName, isLawyer, creditBalance, threads, openIssues }
}

/** Loading skeleton while the shell data resolves. */
function ShellSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 h-14 shrink-0 border-b border-border/60 bg-background/90 backdrop-blur" />
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-border/60 bg-background md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)]" />
        <div className="flex flex-1 flex-col min-w-0 bg-background">
          <main className="flex flex-1 flex-col min-h-0 overflow-hidden bg-background">
            <div className="h-4 w-full animate-pulse bg-muted/60" />
            <div className="h-4 w-full animate-pulse bg-muted/60" />
            <div className="flex-1" />
          </main>
        </div>
      </div>
    </div>
  )
}

/**
 * Server entry point: fetches auth + shell data, then delegates to the
 * interactive ChromeShell client component. Keeps the first paint fast
 * (no client JS for the shell frame) while the interactive layer hydrates
 * with collapse/persist logic.
 */
export async function AppShell({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  const shellData = await getShellData()

  if (!shellData.emailConfirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <MailQuestion className="h-6 w-6 text-muted-foreground" />
              <CardTitle className="text-lg">Verify your email</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please check your inbox at <strong>{shellData.user.email}</strong> and click the
              verification link to activate your account.
            </p>
            <p className="text-xs text-muted-foreground">
              Didn&apos;t receive the email? Check your spam folder — new-account mail often lands in
              Promotions — then resend below. Links expire after 24 hours.
            </p>
            <ResendVerificationButton />
            <form
              action={async () => {
                "use server"
                const supabase = await createClient()
                await supabase.auth.signOut()
                redirect("/login")
              }}
            >
              <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground">
                <LogOut className="h-3 w-3 mr-1" />
                Sign out and use a different account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Suspense fallback={<ShellSkeleton />}>
      <ChromeShell
        email={shellData.email ?? ""}
        businessName={shellData.businessName}
        isLawyer={shellData.isLawyer}
        creditBalance={shellData.creditBalance}
        threads={shellData.threads}
        openIssues={shellData.openIssues}
        bare={bare}
      >
        {children}
      </ChromeShell>
    </Suspense>
  )
}