import Link from "next/link"
import { ChevronRight } from "lucide-react"

const cardBase = "rounded-xl border bg-[#1a1a1a] p-5 shadow-lg"

export function LandingHero() {
  return (
    <section
      className="flex min-h-screen items-center px-6 pt-14"
      style={{
        background:
          "radial-gradient(ellipse 300px 400px at 15% 0%, rgba(139,0,0,0.4) 0%, transparent 70%), radial-gradient(ellipse 350px 450px at 50% 0%, rgba(139,0,0,0.45) 0%, transparent 70%), radial-gradient(ellipse 300px 400px at 85% 0%, rgba(139,0,0,0.35) 0%, transparent 70%), linear-gradient(to top, #4a0000 0%, #1a0000 45%, #080808 100%)",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
        <div className="lg:w-[55%]">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.12em] text-brand-red">
            For freelancers and consultants
          </p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:max-w-[580px]">
            Know if a client
            <br />
            is worth it before
            <br />
            you say yes.
          </h1>
          <p className="mt-5 max-w-[480px] text-base leading-relaxed text-[#a0a0a0]">
            Paste a brief. Get a risk report. Leave with a signed contract that actually protects you.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-red-hover transition-colors"
            >
              Analyze your first deal free
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-3 text-xs text-[#606060]">No credit card required. Takes 60 seconds.</p>
          <Link href="/login" className="mt-2 inline-block text-sm text-[#a0a0a0] hover:text-white transition-colors">
            Already have an account? Sign in
          </Link>
        </div>

        <div className="relative lg:w-[45%] lg:pl-4">
          <div className="relative flex flex-col items-center gap-4" style={{ perspective: "1000px" }}>
            <div
              className={`${cardBase} w-full max-w-md border-[#2a2a2a]`}
              style={{ transform: "translateY(-8px) rotateX(2deg)" }}
            >
              <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-brand-red">Risk analysis</p>
              <p className="mb-3 text-sm font-semibold text-white">E-commerce Website Redesign</p>
              <span className="mb-4 inline-block rounded-full bg-brand-red/20 px-2.5 py-0.5 text-[11px] font-medium text-brand-red">
                HIGH RISK
              </span>
              <div className="mt-3 space-y-2.5">
                <div className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-700" />
                  <div>
                    <span className="font-medium text-red-400">CRITICAL</span>
                    <span className="ml-1.5 text-[#a0a0a0]">"And anything else we need" in scope description</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" />
                  <div>
                    <span className="font-medium text-orange-400">HIGH</span>
                    <span className="ml-1.5 text-[#a0a0a0]">No deposit clause on a 14-week project</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" />
                  <div>
                    <span className="font-medium text-orange-400">HIGH</span>
                    <span className="ml-1.5 text-[#a0a0a0]">IP transfers before final payment</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-[#2a2a2a] pt-3 text-[10px] text-[#606060]">8 categories analyzed</div>
            </div>

            <div
              className={`${cardBase} w-full max-w-sm border-[#2a2a2a]`}
              style={{ transform: "translateY(-12px) translateX(20px) rotateX(1deg) rotateY(-1deg)" }}
            >
              <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[#606060]">Protection package</p>
              <div className="space-y-2">
                {["Proposal", "Scope of Work", "Contract", "Deliverables Checklist"].map((doc) => (
                  <div key={doc} className="flex items-center gap-2 text-xs">
                    <span className="text-brand-red">&#10003;</span>
                    <span className="text-[#a0a0a0]">{doc}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-[#2a2a2a] pt-3 text-[10px] text-[#606060]">Generated in 23 seconds</div>
            </div>

            <div
              className={`${cardBase} w-full max-w-xs border-[#2a2a2a]`}
              style={{ transform: "translateY(-20px) translateX(10px) rotateX(0.5deg)" }}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-2 w-2 rounded-full bg-green-500" />
                <div>
                  <p className="text-xs font-medium text-white">Sarah Chen signed the contract</p>
                  <p className="text-[10px] text-[#606060]">Today at 2:41 PM</p>
                </div>
              </div>
              <div className="mt-2 border-t border-[#2a2a2a] pt-2 text-[10px] text-[#606060]">Agreement recorded</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
