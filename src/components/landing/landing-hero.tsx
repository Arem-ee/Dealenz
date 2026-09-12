import Link from "next/link"

export function LandingHero() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-6 sm:px-10 lg:px-16 py-16 lg:py-24">
      <div>
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
        <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-[var(--primary)]/15 to-[var(--primary)]/35 border border-white/50" />
        <div className="absolute top-6 right-0 w-[70%] rounded-2xl glass-extreme-panel shadow-xl p-5 rotate-2">
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
        <div className="absolute bottom-8 left-0 w-[65%] rounded-2xl glass-extreme-panel shadow-xl p-5 -rotate-1">
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