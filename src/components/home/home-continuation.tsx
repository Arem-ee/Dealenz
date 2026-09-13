import Link from "next/link"
import { MessageCircle, FileText, ArrowRight, Clock } from "lucide-react"

interface DealItem {
  id: string
  title: string
  status: string
  riskLevel: string | null
  updated_at: string
  created_at: string
}

interface ConversationItem {
  id: string
  title: string
  attachedAuditId: string | null
  updatedAt: string
}

function formatDate(date: string): string {
  const d = new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function HomeContinuation({
  deals,
  conversations,
}: {
  deals: DealItem[]
  conversations: ConversationItem[]
}) {
  const hasDeals = deals.length > 0
  const hasConversations = conversations.length > 0
  const hasAny = hasDeals || hasConversations

  if (!hasAny) {
    return (
      <div className="mx-auto max-w-[720px] mt-12 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
        <p className="text-sm font-medium">Bring something you are working on into Dealenz.</p>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
          A contract, a clause, a landlord email, a founder agreement — paste it above and we will surface what matters before you commit.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/audit/new" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            New deal
          </Link>
          <Link href="/ask" className="inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-4 py-2 text-xs font-medium hover:bg-muted/50 transition-colors">
            Ask a question
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[960px] mt-10 space-y-7">
      {hasConversations && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Continue</h2>
            {conversations.length > 3 && (
              <Link href="/ask" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                View all
              </Link>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {conversations.slice(0, 4).map((c) => (
              <Link
                key={c.id}
                href={`/ask?conversation=${encodeURIComponent(c.id)}`}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-surface hover:shadow-raised hover:-translate-y-px transition-all"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate group-hover:text-foreground">{c.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{formatDate(c.updatedAt)}</span>
                </span>
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {hasDeals && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Your deals</h2>
            {deals.length > 4 && (
              <Link href="/deals" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                View all
              </Link>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {deals.slice(0, 5).map((d) => (
              <Link
                key={d.id}
                href={`/audit/${d.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-surface hover:bg-muted/40 transition-colors group"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{d.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {d.status === "analyzed" && d.riskLevel ? `${d.riskLevel} risk` : d.status.replace("_", " ")} · {formatDate(d.updated_at ?? d.created_at)}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  {formatDate(d.updated_at ?? d.created_at)}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
