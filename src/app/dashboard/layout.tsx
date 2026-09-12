import { redirect } from "next/navigation"
import { MailQuestion, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SidebarNav } from "@/components/sidebar-nav"
import { TopNav } from "@/components/top-nav"
import { MobileNav } from "@/components/mobile-nav"
import { resendVerification } from "@/app/login/actions"
import { VerificationBanner } from "@/components/verification-banner"
import { UsageDisplay } from "@/components/usage-display"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (!user.email_confirmed_at) {
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
              Please check your inbox at <strong>{user.email}</strong> and click the
              verification link to activate your account.
            </p>
            <p className="text-xs text-muted-foreground">
              Didn&apos;t receive the email? Check your spam folder or try again below.
            </p>
            <form
              action={async () => {
                "use server"
                await resendVerification()
              }}
            >
              <Button type="submit" variant="outline" size="sm" className="w-full">
                Resend verification email
              </Button>
            </form>
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

  const email = user.email ?? ""

  const { data: businessProfile } = await supabase
    .from("business_profiles")
    .select("business_name")
    .eq("user_id", user.id)
    .maybeSingle()

  const businessName = (businessProfile as { business_name: string | null } | null)?.business_name ?? null

  // Lawyer entry: verified lawyers only. Computed server-side so ordinary
  // customers never see lawyer tools; the workspace itself re-verifies.
  const { data: lawyerRow } = await supabase
    .from("lawyers")
    .select("id")
    .eq("user_id", user.id)
    .eq("verification_status", "verified")
    .maybeSingle()
  const isLawyer = lawyerRow !== null

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav email={email} businessName={businessName} isLawyer={isLawyer} />
      <div className="flex flex-1 flex-col min-w-0">
        <TopNav />
        <UsageDisplay />
        <main className="flex-1 pb-16 md:pb-0">
          <VerificationBanner />
          {children}
        </main>
      </div>
      <MobileNav isLawyer={isLawyer} />
    </div>
  )
}
