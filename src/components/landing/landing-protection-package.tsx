import { IconContract, IconDeal } from "@/components/icons"
import { FileText, ListChecks, FileSpreadsheet } from "lucide-react"

const docs = [
  {
    name: "Proposal",
    desc: "Sets expectations before the engagement starts. Scope conversations happen before the contract, not after.",
    icon: FileText,
  },
  {
    name: "Scope of Work",
    desc: "Defines what is included and what is not. The document you reference when a client says \"can we just add one more thing.\"",
    icon: FileSpreadsheet,
  },
  {
    name: "Contract",
    desc: "Covers payment, IP, revision limits, and termination. Protective language calibrated to the risk report findings.",
    icon: IconContract,
  },
  {
    name: "Deliverables Checklist",
    desc: "A live scope tracker for the active project. Mark items in-scope, out-of-scope, or change order as work progresses.",
    icon: ListChecks,
  },
]

export function LandingProtectionPackage() {
  return (
    <section className="bg-white px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-red">What you get</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-[#1a0f0f] sm:text-4xl">
          Every deal leaves with
          <br />
          a full set of documents.
        </p>
        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {docs.map((d) => {
            const Icon = d.icon
            return (
              <div key={d.name} className="rounded-xl border border-black/[0.06] bg-[#fdfaf7] p-6 shadow-sm">
                <Icon className="mb-3 h-5 w-5 text-brand-red" />
                <p className="text-base font-semibold text-[#1a0f0f]">{d.name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.desc}</p>
              </div>
            )
          })}
        </div>
        <p className="mx-auto mt-10 max-w-lg text-center text-xs leading-relaxed text-muted-foreground">
          Documents are AI-generated and should be reviewed before use. Dealenz is not a law firm. This is not legal
          advice.
        </p>
      </div>
    </section>
  )
}
