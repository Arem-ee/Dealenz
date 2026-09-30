import { Check, X } from "lucide-react"

export function Comparison() {
  const rows: Array<{
    label: string
    dealenz: { ok: boolean; text: string }
    generic: { ok: boolean; text: string }
    manual: { ok: boolean; text: string }
  }> = [
    {
      label: "Risk conclusions",
      dealenz: { ok: true, text: "Deterministic rules decide; AI explains" },
      generic: { ok: false, text: "Model guesses, invents citations" },
      manual: { ok: true, text: "Lawyer judgment, at hourly rates" },
    },
    {
      label: "Source grounding",
      dealenz: { ok: true, text: "Every finding links to its clause" },
      generic: { ok: false, text: "No verifiable link to your document" },
      manual: { ok: true, text: "Margin notes and redlines" },
    },
    {
      label: "Turnaround",
      dealenz: { ok: true, text: "Minutes from intake to pushback words" },
      generic: { ok: true, text: "Fast, but unverified" },
      manual: { ok: false, text: "Days to weeks per agreement" },
    },
    {
      label: "After signing",
      dealenz: { ok: true, text: "Renewals and deadlines stay tracked" },
      generic: { ok: false, text: "Conversation ends at the answer" },
      manual: { ok: false, text: "Calendar entries someone must maintain" },
    },
    {
      label: "Cost model",
      dealenz: { ok: true, text: "Credits per deal outcome, no subscription" },
      generic: { ok: true, text: "Monthly seat regardless of use" },
      manual: { ok: false, text: "Hourly billing, uncapped" },
    },
  ]

  return (
    <section id="solutions" className="bg-paper py-28 text-neutral-900 lg:py-40">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="display-h text-[30px] leading-[1.12] text-neutral-900 sm:text-[40px]">
            Deal & Contract Intelligence engineered for enterprise certainty.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-600">
            Where generative AI guesses, Dealenz validates every output against deterministic
            legal playbooks. AI proposes; rulepacks verify; you maintain sovereign control.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-5xl overflow-x-auto border border-neutral-900 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="bg-pine-900 text-[11px] uppercase tracking-[0.08em] text-white">
                <th scope="col" className="px-5 py-4 font-semibold"><span className="sr-only">Capability</span></th>
                <th scope="col" className="px-5 py-4 font-semibold">Dealenz</th>
                <th scope="col" className="px-5 py-4 font-semibold">Generic AI chat</th>
                <th scope="col" className="px-5 py-4 font-semibold">Manual review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="px-5 py-4 text-[13px] font-semibold text-neutral-900">{r.label}</th>
                  {([r.dealenz, r.generic, r.manual] as const).map((c, i) => (
                    <td key={i} className={`px-5 py-4 ${i === 0 ? "bg-pine-700/[0.07]" : ""}`}>
                      <span className="flex items-start gap-2 text-[13px] text-neutral-700">
                        {c.ok
                          ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-neutral-900" strokeWidth={3} />
                          : <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />}
                        <span>{c.text}</span>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center text-[11px] text-neutral-400">Illustrated comparison of capabilities, not measured outcomes</p>
      </div>
    </section>
  )
}
