import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { IconClient } from "@/components/icons"

export const dynamic = "force-dynamic"

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (!user.email_confirmed_at) {
    redirect("/dashboard")
  }

  const { data: audits } = await supabase
    .from("audits")
    .select("id, title, created_at, overall_score, risk_report")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  const hasDeals = audits && audits.length > 0

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold">Clients</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Client profiles and deal history
        </p>
      </div>

      {!hasDeals ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <IconClient className="h-10 w-10 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium">No client profiles yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Client profiles are in preview: create a deal first. Full history,
              risk patterns, and agreement tracking are not available yet.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            New Deal
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <IconClient className="h-8 w-8 text-muted-foreground/30" />
          <div className="max-w-md">
            <p className="text-sm font-medium">Client profiles are in preview</p>
            <p className="text-xs text-muted-foreground mt-1">
              Client profiles will link to your deals automatically. For now,
              you can view client information within each deal workspace.
            </p>
          </div>
          <div className="mt-4 space-y-2 w-full max-w-sm">
            {audits!.slice(0, 5).map((a) => (
              <Link
                key={a.id}
                href={`/audit/${a.id}`}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <IconClient className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
