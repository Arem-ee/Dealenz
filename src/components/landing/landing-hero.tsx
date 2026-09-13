import Link from "next/link"

export function LandingHero() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-6 sm:px-10 lg:px-16 py-16 lg:py-24">
      <div className="animate-fade-in-up">
        <span className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-[#141110]/70">
          For any agreement
        </span>
        <h1 className="mt-6 font-extrabold tracking-tight leading-[0.92] text-[clamp(3rem,7vw,6rem)] text-[#141110]">
          Know the risk before you sign.
        </h1>
        <p className="mt-6 max-w-md text-base text-[#141110]/70">
          Dealenz reads your contract and tells you plainly where the risk is before you commit.
        </p>
        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/audit/new"
            className="rounded-full bg-[var(--primary)] text-white px-6 py-3.5 text-sm font-medium"
          >
            Analyze your deal free
          </Link>
          <span className="text-xs text-[#141110]/50">No credit card required. Takes 90 seconds.</span>
        </div>
      </div>

      <div className="relative h-[420px] lg:h-[520px] w-full">
        <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/40 border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] overflow-hidden">
          <div className="absolute inset-0 rounded-[28px] opacity-[0.035]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #1C1917 1.2px, transparent 0)", backgroundSize: "22px 22px" }} />
          <div className="absolute -right-10 -bottom-10 h-[220px] w-[220px] rounded-full bg-white/20 blur-[40px]" />
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-red/[0.06] blur-[50px]" />
        </div>
        <div className="absolute top-10 left-6 hidden sm:block h-[200px] w-[58%] rounded-2xl bg-white/18 border border-white/30 backdrop-blur-md shadow-[0_8px_24px_rgba(20,17,16,0.07)] rotate-1" />
        <div className="absolute top-6 right-0 z-10 w-[70%] rounded-2xl glass-extreme-panel shadow-[0_28px_70px_-14px_rgba(20,17,16,0.32)] ring-1 ring-black/5 border-white/70 p-5 rotate-[2.2deg]">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[#141110]/70">Risk analysis</p>
          <p className="mb-3 text-sm font-semibold text-[#141110]">E-commerce Website Redesign</p>
          <span className="mb-4 inline-block rounded-full bg-[var(--primary)]/10 px-2.5 py-0.5 text-[11px] font-medium text-[var(--primary)]">
            HIGH RISK
          </span>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-start gap-2 text-xs">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-700" />
              <div>
                <span className="font-medium text-red-600">CRITICAL</span>
                <span className="ml-1.5 text-[#141110]/70">Unlimited revision language detected</span>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
              <div>
                <span className="font-medium text-amber-600">HIGH</span>
                <span className="ml-1.5 text-[#141110]/70">No deposit clause on a 14-week project</span>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
              <div>
                <span className="font-medium text-amber-600">HIGH</span>
                <span className="ml-1.5 text-[#141110]/70">IP transfers before final payment</span>
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-white/30 pt-3 text-[10px] text-[#141110]/50">8 categories analyzed</div>
        </div>
        <div className="absolute bottom-4 -left-1 w-[68%] rounded-2xl glass-extreme-panel shadow-[0_20px_50px_-14px_rgba(20,17,16,0.26)] ring-1 ring-black/5 border-white/60 p-5 -rotate-[1.8deg]">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[#141110]/50">Protection package</p>
          <div className="space-y-2">
            {["Proposal", "Scope of Work", "Contract", "Deliverables Checklist"].map((doc) => (
              <div key={doc} className="flex items-center gap-2 text-xs">
                <span className="text-[var(--primary)]">✓</span>
                <span className="text-[#141110]/70">{doc}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-white/30 pt-3 text-[10px] text-[#141110]/50">Generated in 23 seconds</div>
        </div>
      </div>
    </div>
  )
}