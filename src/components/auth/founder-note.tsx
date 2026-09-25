// Founder note for the auth side panel. Replaces the rotating quote cards:
// a carousel next to a password field is decoration competing for focus,
// while a personal note is a trust instrument — which is what an auth page
// needs to convert. Static by design (no timers, no motion), theme-aware,
// and shared by login and register so the voice stays identical.
export function FounderNote() {
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
            Someone sends you a contract on a Tuesday. Fourteen pages, due Friday, written by
            their lawyer — not yours. You have read enough of these to know the danger is never
            in the parts you understand.
          </p>
          <p>
            I built Dealenz for exactly that moment. It reads every clause, flags what can hurt
            you with the evidence attached, overrules its own AI with deterministic checks when
            the two disagree, and hands you the exact words to send back.
          </p>
          <p>
            It works for you — never for the close. If the deal is bad, it says so plainly,
            even if that means telling you to walk away.
          </p>
        </blockquote>

        <p className="mt-6 text-[13px] font-semibold">— Toromade, founder of Dealenz</p>

        <p className="mt-8 max-w-[32ch] text-[12px] leading-relaxed text-foreground/40">
          Free to start · No credit card · Your work stays yours.
        </p>
      </div>
    </div>
  )
}
