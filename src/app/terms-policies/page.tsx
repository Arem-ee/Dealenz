import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

export const metadata = {
  title: "Terms & Policies Directory",
}

const ENTRIES = [
  {
    href: "/terms",
    title: "Terms of Service",
    desc: "The agreement between you and Dealenz for using the product.",
  },
  {
    href: "/privacy",
    title: "Privacy Policy",
    desc: "What data we hold, why we hold it, and the rights you have over it.",
  },
  {
    href: "/dpa",
    title: "Data Processing Agreement",
    desc: "How Dealenz processes customer data, subprocessors, retention, and transfers. Signed copies available on request.",
  },
  {
    href: "/security",
    title: "Security",
    desc: "Access controls, encryption, auditability, and our SOC 2 Type II audit status.",
  },
  {
    href: "/methodology",
    title: "Methodology & Rules",
    desc: "How review works: deterministic rules, evidence grounding, and the limits of AI analysis.",
  },
]

export default function TermsPoliciesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Dealenz
        </Link>
        <h1 className="display-h mt-8 text-3xl text-foreground sm:text-4xl">Terms & Policies Directory</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every governing document, in one place. Nothing here is legal advice.
        </p>
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {ENTRIES.map((e) => (
            <li key={e.href}>
              <Link href={e.href} className="group flex items-center justify-between gap-4 py-5">
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold group-hover:underline">{e.title}</span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">{e.desc}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
