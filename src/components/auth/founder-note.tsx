"use client"

// Founder note for the auth side panel. Replaces the rotating quote cards:
// a carousel next to a password field is decoration competing for focus,
// while a personal note is a trust instrument — which is what an auth page
// needs to convert. Static by design (no timers, no motion), theme-aware,
// and shared by login and register so the voice stays identical.
//
// Voice contract: respect the reader's competence. They sign real paper and
// know the stakes — Dealenz is leverage, not a lecture. Tool verbs only:
// the user acts, the product extends them.
import { useState } from "react"
import Image from "next/image"

export function FounderNote() {
  // Photo is progressive enhancement: drop public/founder.jpg into the repo
  // and it appears; until then (or if it ever 404s) initials hold the space
  // instead of a broken image on a trust-critical screen.
  const [photoOk, setPhotoOk] = useState(true)

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-background p-8 lg:p-10">
      <div className="absolute -left-24 -top-24 h-[380px] w-[380px] rounded-full bg-burgundy/10 blur-[70px]" aria-hidden />
      <div className="absolute -bottom-20 -right-20 h-[420px] w-[420px] rounded-full bg-foreground/[0.04] blur-[70px]" aria-hidden />

      <div className="relative w-full max-w-[420px]">
        <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/30">
          A note from the founder
        </p>

        <blockquote className="space-y-4 text-[17px] font-medium leading-relaxed tracking-[-0.01em]">
          <p>
            You&apos;ve signed enough paper to know the feeling: fourteen pages on a Tuesday, due
            Friday, written by their lawyer — not yours. You don&apos;t need anyone to tell you
            to be careful.
          </p>
          <p>
            You need leverage. That&apos;s what Dealenz is — machine thoroughness on your side:
            every clause checked against codified rules that overrule the AI itself, and the
            pushback drafted in your voice, ready to send.
          </p>
          <p>
            The call stays yours. Dealenz just makes sure you never sign something you
            haven&apos;t truly read.
          </p>
        </blockquote>

        <p className="mt-6 flex items-center gap-3">
          {photoOk ? (
            <Image
              src="/founder.jpg"
              alt="Toromade, founder of Dealenz"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
              onError={() => setPhotoOk(false)}
            />
          ) : (
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-burgundy/10 text-sm font-bold text-burgundy">
              T
            </span>
          )}
          <span className="text-[13px] font-semibold">Toromade, founder of Dealenz</span>
        </p>

        <p className="mt-8 max-w-[32ch] text-[12px] leading-relaxed text-foreground/40">
          Free to start · No credit card · Your work stays yours.
        </p>
      </div>
    </div>
  )
}
