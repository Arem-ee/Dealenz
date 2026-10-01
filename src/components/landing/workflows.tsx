import { EarthGlobe } from "@/components/landing/earth-globe"
import { Reveal } from "@/components/landing/reveal"

export function Workflows() {
  return (
    <section className="bg-paper py-28 text-neutral-900 lg:py-40">
      <Reveal className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="max-w-xl">
          <h2 className="display-h text-[24px] leading-[1.15] text-neutral-900 sm:text-[32px]">
            Experience every solution worldwide under a unified contract
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">
            Bring intake, review, signing, and tracking together with Dealenz, unifying
            your existing workflow everywhere you operate.
          </p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-pine-700">
            Drag the globe to explore
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-4xl">
          <EarthGlobe />
          <p className="mt-3 text-center text-[11px] text-neutral-400">
            Live coverage map. Illustrated positions.
          </p>
        </div>
      </Reveal>
    </section>
  )
}
