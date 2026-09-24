"use client"

import Link from "next/link"
import { FileUp, Inbox, Files, SearchCheck } from "lucide-react"

// First-view capability map: one tap per thing Dealenz does. Entry points,
// not explanations — no tours, no tooltips, no checklist. The single place
// a user learns the product by reading, DocuSign-nav style.
const CAPABILITIES = [
  {
    href: "/audit/new",
    label: "Analyze a contract",
    hint: "Paste or upload their paper",
    Icon: FileUp,
  },
  {
    href: "/library?mode=inbox",
    label: "Import from Gmail",
    hint: "Pull a deal thread in",
    Icon: Inbox,
  },
  {
    href: "/batch/new",
    label: "Batch analysis",
    hint: "Up to 10 contracts at once",
    Icon: Files,
  },
  {
    href: "/counterparty/new",
    label: "Research a counterparty",
    hint: "Verify who you're signing with",
    Icon: SearchCheck,
  },
]

export function CapabilityStrip() {
  return (
    <nav aria-label="What Dealenz does" className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
      {CAPABILITIES.map(({ href, label, hint, Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm transition-colors hover:bg-muted/40"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-burgundy/10 text-burgundy transition-colors group-hover:bg-burgundy/15">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{label}</span>
            <span className="block truncate text-[11px] text-foreground/50">{hint}</span>
          </span>
        </Link>
      ))}
    </nav>
  )
}
