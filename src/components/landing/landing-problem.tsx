export function LandingProblem() {
  return (
    <section className="bg-white px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-[720px]">
        <div className="pointer-events-none absolute left-1/2 top-0 h-px w-full max-w-3xl -translate-x-1/2 bg-gradient-to-r from-transparent via-brand-red/10 to-transparent" />
        <p className="text-center text-3xl font-semibold leading-[1.15] tracking-tight text-[#1a0f0f] sm:text-4xl md:text-5xl">
          &ldquo;By the time you notice the bad terms,
          <br className="hidden sm:inline" />
          you have already said yes.&rdquo;
        </p>
        <div className="mt-14 space-y-6 border-l-2 border-brand-red/15 pl-6 text-base font-light leading-relaxed text-muted-foreground sm:pl-8 sm:text-lg">
          <p>The brief said simple website. The kickoff call had 47 pages of requirements.</p>
          <p>There was no deposit clause. They went quiet after the first draft.</p>
          <p>The contract transferred all IP before final payment. Nobody caught it.</p>
          <p>They called it a few tweaks. Three months of unpaid work later.</p>
        </div>
        <p className="mt-16 text-center text-sm text-muted-foreground">
          Most of this is visible in the first message. Dealenz is built to catch it before you sign.
        </p>
      </div>
    </section>
  )
}
