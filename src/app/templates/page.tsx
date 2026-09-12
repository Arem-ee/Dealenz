import Link from "next/link"
import type { ComponentType } from "react"
import { redirect } from "next/navigation"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { IconProposal, IconSow, IconContract, IconChecklist } from "@/components/icons"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

interface Template {
  id: string
  category: "proposal" | "sow" | "contract" | "checklist"
  title: string
  description: string
  dealType: string
}

const templates: Template[] = [
  { id: "web-design-proposal", category: "proposal", title: "Web Design Project Proposal", description: "Standard proposal for website design projects covering scope, timeline, and investment.", dealType: "Web Design" },
  { id: "brand-identity-proposal", category: "proposal", title: "Brand Identity Proposal", description: "Proposal for brand identity projects including logo, guidelines, and brand strategy.", dealType: "Brand Identity" },
  { id: "consulting-engagement-proposal", category: "proposal", title: "Consulting Engagement Proposal", description: "Professional consulting proposal with engagement structure and deliverables.", dealType: "Consulting" },
  { id: "website-development-sow", category: "sow", title: "Website Development SOW", description: "Covers pages, CMS setup, responsive design, and handover procedures.", dealType: "Web Development" },
  { id: "brand-identity-sow", category: "sow", title: "Brand Identity SOW", description: "Scope covering logo design, brand guidelines, and file format delivery.", dealType: "Brand Identity" },
  { id: "content-strategy-sow", category: "sow", title: "Content Strategy SOW", description: "Content audit, strategy development, and editorial calendar creation.", dealType: "Content Strategy" },
  { id: "freelance-services-agreement", category: "contract", title: "Freelance Services Agreement", description: "General-purpose services agreement with standard terms and payment schedule.", dealType: "General" },
  { id: "web-development-contract", category: "contract", title: "Web Development Contract", description: "Development contract including hosting, maintenance, and warranty clauses.", dealType: "Web Development" },
  { id: "creative-services-contract", category: "contract", title: "Creative Services Contract", description: "Covers IP ownership, usage rights, and portfolio clause for creative work.", dealType: "Creative" },
  { id: "website-project-checklist", category: "checklist", title: "Website Project Checklist", description: "End-to-end checklist from design through development, QA, and launch.", dealType: "Web Design" },
  { id: "brand-project-checklist", category: "checklist", title: "Brand Project Checklist", description: "Discovery, concepts, refinement, and delivery milestones for brand projects.", dealType: "Brand Identity" },
  { id: "consulting-engagement-checklist", category: "checklist", title: "Consulting Engagement Checklist", description: "Kickoff, milestones, deliverables, and closeout checklist for consulting.", dealType: "Consulting" },
]

const categories = ["all", "proposal", "sow", "contract", "checklist"] as const
const categoryLabels: Record<string, string> = { all: "All", proposal: "Proposals", sow: "Scopes of Work", contract: "Contracts", checklist: "Checklists" }
const categoryIcons: Record<string, ComponentType<{ className?: string }>> = { proposal: IconProposal, sow: IconSow, contract: IconContract, checklist: IconChecklist }

async function TemplatesPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (!user.email_confirmed_at) {
    redirect("/dashboard")
  }

  const { category } = await searchParams
  const active = (categories as readonly string[]).includes(category ?? "") ? category : "all"
  const filtered = active === "all" ? templates : templates.filter((t) => t.category === active)

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Templates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vetted starting points for proposals, scopes of work, contracts, and checklists
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b">
        {categories.map((cat) => (
          <Link
            key={cat}
            href={cat === "all" ? "/templates" : `/templates?category=${cat}`}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              active === cat
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {categoryLabels[cat]}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((t) => {
          const Icon = categoryIcons[t.category]
          return (
            <div key={t.id} className="rounded-xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{t.title}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Vetted
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-medium rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      {t.dealType}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-4">
                <Button asChild size="sm" className="w-full">
                  <Link href={`/audit/new?template=${t.id}`}>
                    Use Template
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TemplatesPage
