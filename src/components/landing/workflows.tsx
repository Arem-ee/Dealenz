import { EarthGlobe } from "@/components/landing/earth-globe"

export function Workflows() {
  return (
    <section className="bg-paper py-20 text-neutral-900 lg:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div>
          <h2 className="display-h text-[30px] leading-[1.12] text-neutral-900 sm:text-[40px]">
            Experience every solution worldwide under a unified contract
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-neutral-600">
            Bring intake, review, signing, and tracking together with Dealenz, unifying
            your existing workflow everywhere you operate.
          </p>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-pine-700">
            Drag the globe to explore
          </p>
        </div>

        <div>
          <EarthGlobe />
          <p className="mt-3 text-center text-[11px] text-neutral-400">
            Live coverage map. Illustrated positions.
          </p>
        </div>
      </div>
    </section>
  )
}
