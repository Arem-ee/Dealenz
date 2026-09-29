import React from "react"
import { CircuitBackdrop } from "./circuit-backdrop"
import { Mail, PenTool, Database, FileSpreadsheet, Send, FileCheck } from "lucide-react"

export function ConnectIntegrationsSection() {
  const integrationIcons = [
    { name: "Gmail & Outlook", icon: <Mail className="h-5 w-5 text-red-400" /> },
    { name: "Google Drive", icon: <Database className="h-5 w-5 text-amber-400" /> },
    { name: "Slack & Teams", icon: <Send className="h-5 w-5 text-purple-400" /> },
    { name: "DocuSign", icon: <PenTool className="h-5 w-5 text-blue-400" /> },
    { name: "Salesforce", icon: <FileSpreadsheet className="h-5 w-5 text-sky-400" /> },
    { name: "Microsoft Word", icon: <FileCheck className="h-5 w-5 text-blue-500" /> },
  ]

  const pillars = [
    {
      title: "Automated Inbox Surveillance",
      desc: "Connect Gmail once. Incoming contract attachments are parsed automatically, and critical renewal notice windows trigger alerts straight to your inbox.",
    },
    {
      title: "Zero-Friction Counterparty E-Sign",
      desc: "You sign first, then counterparties sign through an encrypted link with zero account creation or software download required on their side.",
    },
    {
      title: "Clean Outside Counsel Handoff",
      desc: "Export pre-structured dossiers, quoted clause diffs, and risk summaries ready for your outside legal counsel when high-stakes human sign-off is needed.",
    },
    {
      title: "Client-Side Privacy Masking",
      desc: "Scrub emails, phone numbers, client identifiers, and confidential terms locally in your browser before data reaches our secure EU-hosted servers.",
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
            <div className="relative mx-2 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-500/20 via-neutral-900 to-black shadow-[0_0_40px_rgba(245,158,11,0.5)]">
              <span className="text-center font-mono text-[14px] font-extrabold tracking-tight text-amber-300">
                DEALENZ
                <span className="block text-[8px] font-sans font-normal uppercase tracking-widest text-white/60">Core Engine</span>
              </span>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
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
