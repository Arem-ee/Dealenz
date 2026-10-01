import { EarthGlobe } from "@/components/landing/earth-globe"
import { Reveal } from "@/components/landing/reveal"

export function Workflows() {
  return (
    <section className="bg-ink py-28 text-white lg:py-40">
      <Reveal className="mx-auto max-w-6xl px-6 lg:px-8">
        <Reveal className="max-w-xl">
        <div className="max-w-xl">
          <h2 className="display-h text-[24px] leading-[1.15] text-white sm:text-[32px]">
            Every capability, one connected surface
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-white/70">
            Intake, analysis, drafts, clauses, signing, tracking, approvals —
            every Dealenz feature wired to every other, wherever you operate.
          </p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-pine-400">
            Drag the globe to explore
          </p>
        </div>
        </Reveal>

        <Reveal delay={0.15}>
        <div className="mx-auto mt-10 max-w-4xl">
          <EarthGlobe />
          <p className="mt-3 text-center text-[11px] text-white/40">
            Every feature interconnected. Illustrated positions.
          </p>
        </div>
        </Reveal>
      </Reveal>
    </section>
  )
}
