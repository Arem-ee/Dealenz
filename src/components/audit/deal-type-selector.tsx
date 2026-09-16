"use client"

import { cn } from "@/lib/utils"

export type DealType = "freelance" | "generic" | "lease" | "purchase_sale" | "employment" | "founder" | "partnership"

interface DealTypeSelectorProps {
  value: DealType | null
  onChange: (type: DealType) => void
}

const CAPABILITY: Record<DealType, { label: string; tone: string }> = {
  founder: { label: "Limited draft", tone: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  partnership: { label: "Limited draft", tone: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  purchase_sale: { label: "Limited draft", tone: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  lease: { label: "Limited draft", tone: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  employment: { label: "Limited draft", tone: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  freelance: { label: "Full documents", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  generic: { label: "Analysis only", tone: "bg-muted text-muted-foreground border-border" },
}

const OPTIONS: Array<{ value: DealType; label: string; description: string }> = [
  {
    value: "founder",
    label: "Founder or startup",
    description: "A co-founder agreement where ownership, vesting, and control matter",
  },
  {
    value: "partnership",
    label: "Partnership",
    description: "A business partnership where contributions, profit share, and control matter",
  },
  {
    value: "purchase_sale",
    label: "Purchase or sale",
    description: "Buying or selling an item, asset, or business where price and handover matter",
  },
  {
    value: "lease",
    label: "Lease or rental",
    description: "A commercial or residential lease you are reviewing before signing",
  },
  {
    value: "employment",
    label: "Employment",
    description: "An employment offer or contract where role, pay, and protections matter",
  },
  {
    value: "freelance",
    label: "Freelance or client work",
    description: "Proposal, scope, contract and checklist for work you will deliver",
  },
  {
    value: "generic",
    label: "Any other agreement",
    description: "Any other agreement you are reviewing before signing",
  },
]

export function DealTypeSelector({ value, onChange }: DealTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">What kind of deal is this</h2>
        <p className="text-sm text-muted-foreground mt-1">Choose the path that matches how you will use the audit</p>
      </div>
      <p className="text-xs text-muted-foreground">Full documents = proposal, scope, contract, checklist. Limited draft = jurisdiction-aware families you fill then generate. Analysis only = no document generation.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value
          const cap = CAPABILITY[opt.value]
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "text-left rounded-xl border p-4 transition-colors",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{opt.label}</p>
                <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", cap.tone)}>{cap.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
