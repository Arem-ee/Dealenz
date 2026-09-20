"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { setPendingDeal } from "@/lib/pending-deal"

// Composer-first landing entry: type the deal before an account exists.
// The text waits in session storage and lands prefilled in the dashboard
// composer after signup/signin — intent is never dropped at registration.
export function LandingHeroComposer() {
  const router = useRouter()
  const [value, setValue] = useState("")

  function handleStart() {
    const text = value.trim()
    if (!text) return
    setPendingDeal(text)
    router.push("/register")
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-[560px]">
      <div className="rounded-2xl border border-black/[0.07] bg-white p-2 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.22)]">
        <label htmlFor="landing-deal-input" className="sr-only">
          Paste your contract or describe your deal
        </label>
        <textarea
          id="landing-deal-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste their contract here — your words wait for you after signup…"
          rows={3}
          className="w-full resize-none bg-transparent px-4 pt-3 text-[14px] leading-relaxed outline-none placeholder:text-black/35"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-1">
          <p className="text-[11px] text-black/40">Free to start. No credit card required.</p>
          <button
            type="button"
            onClick={handleStart}
            disabled={!value.trim()}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#1C1917] px-6 text-[14px] font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
