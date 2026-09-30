import { BellRing, Check } from "lucide-react"

export function Impact() {
  const deadlines = [
    { title: "MSA renewal", meta: "Vendor agreement · Oct 12", state: "30 days", hot: true },
    { title: "Lease notice window", meta: "Office lease · Nov 02", state: "51 days", hot: false },
    { title: "Milestone payment", meta: "Advisory agreement · Dec 01", state: "80 days", hot: false },
  ]

  return (
    <section className="bg-ink py-28 text-white lg:py-40">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div>
          <h2 className="display-h text-[30px] leading-[1.12] text-white sm:text-[40px]">
            Track corporate value from each deal.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
            Transform static agreements into active strategic data. Gain complete portfolio
            visibility into revenue commitments, renewal deadlines, and counterparty exposure.
          </p>
        </div>

        <div>
          <div className="border border-white/20 bg-white/[0.03] p-7">
            <div className="flex items-center gap-2 text-pine-400">
              <BellRing className="h-4 w-4 text-white" />
              <p className="text-[11px] font-bold uppercase tracking-wider">Upcoming deadlines</p>
            </div>
            <ul className="mt-4 space-y-2">
              {deadlines.map((d) => (
                <li
                  key={d.title}
                  className="flex items-center justify-between gap-3 border border-white/15 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-white">{d.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-white/50">{d.meta}</span>
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      d.hot ? "bg-pine-500 text-white" : "border border-white/20 text-white/60"
                    }`}
                  >
                    {d.hot && <Check className="h-3 w-3" />}
                    {d.state}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-l-2 border-pine-500 pl-3 text-[12px] leading-relaxed text-white/60">
              Daily digest by email. Nothing renews quietly.
            </p>
          </div>
          <p className="mt-3 text-center text-[11px] text-white/40">Illustrated example</p>
        </div>
      </div>
    </section>
  )
}
