import Link from "next/link"
import { ArrowRight, Clock } from "lucide-react"

export function BusinessImpactSection() {
  const deals = [
    {
      title: "Master Services Agreement",
      party: "Apex Enterprise Corp",
      score: "68 / 100",
      status: "Redline Active",
      statusColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      notice: "Renewal: Nov 14 (30d)",
      risk: "Medium",
    },
    {
      title: "Cloud Infrastructure SLA",
      party: "HyperScale Networks",
      score: "92 / 100",
      status: "Guarded",
      statusColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      notice: "Uptime: 99.95% active",
      risk: "Low",
    },
    {
      title: "Commercial Office Lease",
      party: "Prime Landmark Holdings",
      score: "42 / 100",
      status: "High Exposure",
      statusColor: "bg-red-500/20 text-red-300 border-red-500/30",
      notice: "Notice Window: 18 days",
      risk: "Critical",
    },
    {
      title: "Strategic Advisory Agreement",
      party: "Venture Partners Ltd",
      score: "88 / 100",
      status: "Executed & Locked",
      statusColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      notice: "Vesting: Q4 Milestone",
      risk: "Low",
    },
  ]

  return (
    <section className="relative overflow-hidden bg-[#0A0D14] py-20 text-white lg:py-28">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -right-20 top-1/2 h-[450px] w-[550px] -translate-y-1/2 rounded-full bg-blue-600/[0.06] blur-[140px]" />
      <div className="pointer-events-none absolute -left-20 bottom-10 h-[400px] w-[500px] rounded-full bg-amber-500/[0.05] blur-[120px]" />

      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          
          {/* Left Column: Sleek Deal Portfolio Table Mockup */}
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121622] p-4 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.8)] sm:p-6">
              
              {/* Table Top Controls */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h4 className="text-[14px] font-bold text-white">Deal Portfolio & Obligation Watchdog</h4>
                  <p className="text-[11px] text-white/50">4 Active Agreements Under Continuous Surveillance</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Monitoring
                </span>
              </div>

              {/* Deals Table */}
              <div className="mt-4 divide-y divide-white/5">
                {deals.map((deal) => (
                  <div key={deal.title} className="flex flex-wrap items-center justify-between gap-3 py-3.5 transition-colors hover:bg-white/[0.02]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-white/95">{deal.title}</p>
                      <p className="truncate text-[11px] text-white/50">{deal.party}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${deal.statusColor}`}>
                          {deal.status}
                        </span>
                        <p className="mt-0.5 text-[10px] text-white/40">{deal.notice}</p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <span className="text-[12px] font-mono font-bold text-white/90">{deal.score}</span>
                        <p className="text-[9px] uppercase tracking-wider text-white/40">Health</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Table Bar */}
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-white/50">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  Next Alert: In 48 hours via Gmail Sync
                </span>
                <span className="font-semibold text-amber-400">Export Full CSV →</span>
              </div>
            </div>
          </div>

          {/* Right Column: Text Copy & Value Metrics */}
          <div className="lg:col-span-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">
              PORTFOLIO OBLIGATION INTELLIGENCE
            </p>
            <h2 className="mt-3 text-[30px] font-bold tracking-tight text-white sm:text-[40px]">
              See the business impact of every contract.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/70">
              Transform passive legal paperwork into active business intelligence. Dealenz monitors payment schedules,
              liability caps, auto-renewal trapdoors, and performance obligations across every contract you execute.
            </p>

            <div className="mt-7">
              <Link
                href="/register"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-7 text-[13px] font-semibold text-neutral-900 transition-transform duration-150 hover:bg-neutral-100 active:scale-95"
              >
                See How It Works
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Dual Metrics Grid */}
            <div className="mt-10 grid grid-cols-2 gap-6 border-t border-white/10 pt-6">
              <div>
                <p className="text-[32px] font-bold tracking-tight text-amber-400 sm:text-[38px]">100%</p>
                <p className="mt-1 text-[12px] font-medium leading-snug text-white/60">
                  Verifiable Source Evidence (Zero black-box hallucinations)
                </p>
              </div>
              <div>
                <p className="text-[32px] font-bold tracking-tight text-white sm:text-[38px]">85%</p>
                <p className="mt-1 text-[12px] font-medium leading-snug text-white/60">
                  Faster turnaround from initial intake to secure execution
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
