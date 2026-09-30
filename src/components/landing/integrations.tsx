import { Mail, Send, FileSpreadsheet, Database } from "lucide-react"

export function Integrations() {
  const live = [
    { name: "Gmail deal intake", icon: <Mail className="h-5 w-5" /> },
    { name: "Email deadline alerts", icon: <Send className="h-5 w-5" /> },
    { name: "Paddle billing", icon: <FileSpreadsheet className="h-5 w-5" /> },
  ]
  const roadmap = [
    { name: "Slack & Teams", icon: <Send className="h-5 w-5" /> },
    { name: "Salesforce", icon: <FileSpreadsheet className="h-5 w-5" /> },
    { name: "SharePoint & Drive", icon: <Database className="h-5 w-5" /> },
  ]

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
    <section className="bg-ink py-20 text-white lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-pine-400">INTEGRATIONS & ECOSYSTEM</p>
          <h2 className="display-h mt-3 text-[30px] text-white sm:text-[40px]">
            Point, Click, & Connect
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/70">
            Dealenz meets your tools where they are. No heavy IT deployment,
            no proprietary lock-in, zero friction for counterparties.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Live today</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {live.map((item) => (
              <div key={item.name} className="flex items-center gap-3 border border-white/15 px-4 py-3">
                <span className="text-pine-400">{item.icon}</span>
                <span className="text-[13px] font-semibold text-white">{item.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">On the roadmap</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {roadmap.map((item) => (
              <div key={item.name} className="flex items-center gap-3 border border-dashed border-white/15 px-4 py-3">
                <span className="text-white/30">{item.icon}</span>
                <span className="text-[13px] font-medium text-white/50">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <div key={pillar.title}>
              <div className="h-0.5 w-10 bg-pine-500" />
              <h3 className="mt-4 text-[15px] font-bold tracking-tight text-white">{pillar.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/60">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
