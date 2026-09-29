import React from "react"
import { ShieldCheck, Building2, Cpu, Globe2, Landmark, Briefcase } from "lucide-react"

export function SocialProofStrip() {
  const logos = [
    { name: "FINTECH GLOBAL", icon: <Landmark className="h-4 w-4" /> },
    { name: "MERIDIAN CAPITAL", icon: <Building2 className="h-4 w-4" /> },
    { name: "APEX ENTERPRISE", icon: <Cpu className="h-4 w-4" /> },
    { name: "CROSS-BORDER VENTURES", icon: <Globe2 className="h-4 w-4" /> },
    { name: "LEGAL OPS ALLIANCE", icon: <Briefcase className="h-4 w-4" /> },
    { name: "VERIFIED SOC2", icon: <ShieldCheck className="h-4 w-4 text-amber-500" /> },
  ]

  return (
    <section className="relative z-10 border-y border-white/10 bg-[#0B0C10] py-8 text-white">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
          Powering deal intelligence, risk governance, and compliance across 10,000+ negotiated agreements
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-12">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="flex items-center gap-2 text-white/40 transition-colors duration-200 hover:text-white/80"
            >
              {logo.icon}
              <span className="text-[12px] font-bold tracking-[0.08em]">{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
