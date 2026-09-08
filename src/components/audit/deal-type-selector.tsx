"use client"

import { cn } from "@/lib/utils"

export type DealType = "freelance" | "generic" | "lease" | "purchase_sale" | "employment" | "founder"

interface DealTypeSelectorProps {
  value: DealType | null
  onChange: (type: DealType) => void
}

const OPTIONS: Array<{ value: DealType; label: string; description: string }> = [
  {
    value: "freelance",
    label: "Freelance or client work",
    description: "Proposal, scope, contract and checklist for work you will deliver",
  },
  {
    value: "purchase_sale",
    label: "Purchase or sale",
    description: "Buying or selling an item, asset, or business where price and handover matter",
  },
  {
    value: "employment",
    label: "Employment",
    description: "An employment offer or contract where role, pay, and protections matter",
  },
  {
    value: "founder",
    label: "Founder or startup",
    description: "A co-founder agreement where ownership, vesting, and control matter",
  },
  {
    value: "generic",
    label: "Any other agreement",
    description: "A partnership or other agreement you are reviewing before signing",
  },
  {
    value: "lease",
    label: "Lease or rental",
    description: "A commercial or residential lease you are reviewing before signing",
  },
]

export function DealTypeSelector({ value, onChange }: DealTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">What kind of deal is this</h2>
        <p className="text-sm text-muted-foreground mt-1">Choose the path that matches how you will use the audit</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value
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
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
