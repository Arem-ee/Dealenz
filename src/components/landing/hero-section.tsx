import { CTAButton } from "@/components/landing/primitives"

export function HeroSection() {
  return (
    <section className="bg-[#0d0d0d] text-[#f0f0f0]">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-start">
          <div className="hidden sm:block sm:w-[55%] pt-16 sm:pt-24">
            <div className="relative overflow-hidden rounded-t-xl border border-[#222] shadow-2xl">
              <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
              </div>
              <img
                src="/workspace-overview.png"
                alt="Dealenz workspace overview"
                className="block h-auto w-full object-contain"
              />
            </div>
          </div>
          <div className="sm:w-[45%] px-4 sm:pl-8 sm:pr-6 pt-16 sm:pt-24">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              Know the risk before you sign.
            </h1>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg leading-relaxed text-[#a0a0a0] max-w-2xl">
              Before you sign anything, whether it&apos;s a contract with a new client, a lease on a place you&apos;re renting, or some partnership deal someone put in front of you, it&apos;s worth knowing what you&apos;re actually agreeing to. That&apos;s what Dealenz does. You give it whatever you&apos;ve got, and it reads through it and tells you plainly where the risk is, instead of leaving you to figure it out on your own after it&apos;s too late to change anything.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-start gap-3">
              <CTAButton variant="primary" href="/register">
                Analyze your deal free
              </CTAButton>
              <CTAButton variant="secondary" href="/login">
                Sign in
              </CTAButton>
            </div>
            <p className="mt-3 text-xs text-[#555]">No credit card required.</p>
          </div>
        </div>
        <div className="sm:hidden px-4 pb-0 pt-12">
          <div className="relative overflow-hidden rounded-t-xl border border-[#222] shadow-2xl">
            <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <img
              src="/workspace-overview.png"
              alt="Dealenz workspace overview"
              className="block h-auto w-full object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
