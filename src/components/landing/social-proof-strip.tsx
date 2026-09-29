import React from "react"
import { ShieldCheck, FileSearch, PenLine, BellRing, Lock, FileCheck2 } from "lucide-react"

export function SocialProofStrip() {
  const markers = [
    { name: "DETERMINISTIC RULES", icon: <ShieldCheck className="h-4 w-4" /> },
    { name: "EVIDENCE-BACKED FINDINGS", icon: <FileSearch className="h-4 w-4" /> },
    { name: "OWNER-FIRST SIGNING", icon: <PenLine className="h-4 w-4" /> },
    { name: "RENEWAL MONITORING", icon: <BellRing className="h-4 w-4" /> },
    { name: "EU-HOSTED · AES-256", icon: <Lock className="h-4 w-4" /> },
    { name: "SOC 2 TYPE II IN PROGRESS", icon: <FileCheck2 className="h-4 w-4 text-amber-500" /> },
  ]

  return (
    <section className="relative z-10 border-y border-white/10 bg-[#0B0C10] py-8 text-white">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
          Built for teams who sign for a living
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-12">
          {markers.map((marker) => (
            <div
              key={marker.name}
              className="flex items-center gap-2 text-white/40 transition-colors duration-200 hover:text-white/80"
            >
              {marker.icon}
              <span className="text-[12px] font-bold tracking-[0.08em]">{marker.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
