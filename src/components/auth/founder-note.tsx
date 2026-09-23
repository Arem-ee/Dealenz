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
            Most people sign paper they didn&apos;t write and can&apos;t fully read. The other
            side has lawyers; you have a deadline.
          </p>
          <p>
            I built Dealenz to close that gap for the person receiving the paper — machine
            thoroughness, checks that overrule the AI when they disagree, and words you can
            actually send back.
          </p>
          <p>
            It works for you, never for the close. If a deal is bad for you, it will say so
            plainly.
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
