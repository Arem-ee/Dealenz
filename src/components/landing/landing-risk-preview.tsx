export function LandingRiskPreview() {
  return (
    <section className="bg-surface pt-24 sm:pt-32 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[720px] px-6 text-center mb-12 sm:mb-16">
        <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          Here is what a recent analysis found.
        </p>
      </div>
      <div className="mx-auto max-w-[680px] px-6">
        <div className="bg-background border border-border rounded-xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-8">
            <p className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              E-commerce Website Redesign
            </p>
            <span className="inline-flex items-center rounded-md bg-risk-high/10 px-2.5 py-1 text-xs font-medium text-risk-high">
              HIGH
            </span>
          </div>
          <div className="space-y-8">
            <div className="border-l-2 border-l-risk-high pl-4 sm:pl-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Payment</span>
                <span className="inline-flex items-center rounded bg-risk-high/10 px-2 py-0.5 text-[11px] font-medium text-risk-high">HIGH</span>
              </div>
              <p className="text-base sm:text-lg font-semibold leading-snug text-foreground mb-1.5">
                No deposit clause on a 12-week project
              </p>
              <p className="text-sm leading-relaxed text-text-secondary">
                Client brief mentions payment &ldquo;upon completion&rdquo; with no milestone structure. Full project risk falls on you.
              </p>
            </div>
            <div className="border-l-2 border-l-risk-critical pl-4 sm:pl-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Scope</span>
                <span className="inline-flex items-center rounded bg-risk-critical/10 px-2 py-0.5 text-[11px] font-medium text-risk-critical">CRITICAL</span>
              </div>
              <p className="text-base sm:text-lg font-semibold leading-snug text-foreground mb-1.5">
                &ldquo;And anything else we need&rdquo; in scope description
              </p>
              <p className="text-sm leading-relaxed text-text-secondary">
                Direct quote from brief. No revision limit, no change order language, no acceptance criteria.
              </p>
            </div>
            <div className="border-l-2 border-l-risk-high pl-4 sm:pl-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">IP</span>
                <span className="inline-flex items-center rounded bg-risk-high/10 px-2 py-0.5 text-[11px] font-medium text-risk-high">HIGH</span>
              </div>
              <p className="text-base sm:text-lg font-semibold leading-snug text-foreground mb-1.5">
                All source files requested before final payment
              </p>
              <p className="text-sm leading-relaxed text-text-secondary">
                Brief asks for &ldquo;full ownership of all assets&rdquo; without specifying when transfer occurs.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[560px] px-6 text-center mt-10 sm:mt-12">
        <p className="text-sm leading-relaxed text-text-muted">
          Real analysis runs on your actual brief. This is a representative example.
        </p>
      </div>
    </section>
  )
}
