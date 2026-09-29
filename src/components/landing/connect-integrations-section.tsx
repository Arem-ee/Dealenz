import React from "react"
import { CircuitBackdrop } from "./circuit-backdrop"
import { Mail, Database, FileSpreadsheet, Send } from "lucide-react"

export function ConnectIntegrationsSection() {
  const live = [
    { name: "Gmail deal intake", icon: <Mail className="h-5 w-5 text-red-400" /> },
    { name: "Email deadline alerts", icon: <Send className="h-5 w-5 text-purple-400" /> },
    { name: "Paddle billing", icon: <FileSpreadsheet className="h-5 w-5 text-sky-400" /> },
  ]
  const roadmap = [
    { name: "Slack & Teams (roadmap)", icon: <Send className="h-5 w-5 text-white/30" /> },
    { name: "Salesforce (roadmap)", icon: <FileSpreadsheet className="h-5 w-5 text-white/30" /> },
    { name: "SharePoint & Drive (roadmap)", icon: <Database className="h-5 w-5 text-white/30" /> },
  ]
  const integrationIcons = [...live, ...roadmap]

  const pillars = [
    {
      title: "Gmail deal intake",
      desc: "Connect Gmail once and import deal threads in one click. New mail shows up where your deals live.",
    },
    {
      title: "Counterparty signing, no accounts",
      desc: "You sign first, then counterparties sign through a link with no account creation or software download.",
    },
    {
      title: "Clean counsel handoff",
      desc: "Structured findings, quoted clauses, and risk summaries prepared for outside counsel when high-stakes sign-off is needed.",
    },
    {
      title: "Client-side privacy masking",
      desc: "Scrub emails, phone numbers, and confidential terms in your browser before data reaches our EU-hosted servers.",
    },
  ]

  return (
    <section className="relative overflow-hidden bg-[#090A0E] py-24 text-white lg:py-32">
      {/* Background glowing amber circuit paths */}
      <CircuitBackdrop variant="integrations" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">
            INTEGRATIONS & ECOSYSTEM
          </p>
          <h2 className="mt-3 text-[34px] font-bold tracking-tight text-white sm:text-[46px]">
            Point, Click, & Connect
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70 sm:text-[16px]">
            Seamlessly integrate Dealenz across your existing tools and workflows. No heavy IT deployment,
            no proprietary lock-in, and zero friction for counterparties.
          </p>
        </div>

        {/* Constellation Circuit Bar with Glowing Nodes (Matching Reference Visual) */}
        <div className="relative mx-auto mt-16 max-w-4xl py-6">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            
            {/* Left Integration Nodes */}
            {integrationIcons.slice(0, 3).map((item) => (
              <div
                key={item.name}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] shadow-lg backdrop-blur-md transition-transform duration-200 hover:scale-110 hover:border-amber-500/50"
                title={item.name}
              >
                {item.icon}
              </div>
            ))}

            {/* Glowing Central Dealenz Core Node */}
            <div className="relative mx-2 flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-400/60 bg-neutral-900">
              <span className="text-center font-mono text-[14px] font-extrabold tracking-tight text-amber-300">
                DEALENZ
                <span className="block text-[8px] font-sans font-normal uppercase tracking-widest text-white/60">Core Engine</span>
              </span>
            </div>

            {/* Right Integration Nodes */}
            {integrationIcons.slice(3, 6).map((item) => (
              <div
                key={item.name}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] shadow-lg backdrop-blur-md transition-transform duration-200 hover:scale-110 hover:border-amber-500/50"
                title={item.name}
              >
                {item.icon}
              </div>
            ))}

          </div>
        </div>

        {/* 4 Architectural Capability Pillars with Amber Underline Bars */}
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="flex flex-col justify-between">
              <div>
                {/* Distinctive Amber Accent Underline Bar */}
                <div className="h-0.5 w-10 bg-amber-500" />
                <h3 className="mt-4 text-[16px] font-bold tracking-tight text-white">{pillar.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/60">{pillar.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
