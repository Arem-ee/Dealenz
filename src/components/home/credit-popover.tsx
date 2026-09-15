"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Diamond } from "lucide-react"
import { getCreditBalanceForHome } from "@/app/dashboard/actions"

export function CreditControl() {
  const [balance, setBalance] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    getCreditBalanceForHome().then((b) => {
      if (typeof b === "number") setBalance(b)
      else setBalance(0)
    }).catch(() => setBalance(0))
  }, [])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={balance !== null ? `${balance} credits` : "Credit balance"}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Diamond className="h-3 w-3 text-burgundy" />
        <span className="tabular-nums">{balance ?? "—"}</span>
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close credit details" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-popover p-4 shadow-overlay">
            <p className="text-sm font-semibold tabular-nums">{balance ?? 0} credits</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Ask uses 1 to 8 credits depending on depth. Brief is 1, standard 3, extended 8. Greetings use 0. Free daily analyses never use credits.
            </p>
            <Link
              href="/billing"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get more
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
