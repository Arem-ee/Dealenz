import Link from "next/link"
import { ArrowRight, Check, Minus, X } from "lucide-react"

export function CustomerLoveSection() {
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
    <section className="relative overflow-hidden bg-[#F8F8F6] py-20 text-neutral-900 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">

        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
            WHY TEAMS SWITCH
          </p>
          <h2 className="mt-3 text-[32px] font-bold tracking-tight text-neutral-900 sm:text-[44px]">
            Proof, not promises.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] text-neutral-600 sm:text-[16px]">
            Generic AI is fast and unverified. Manual review is verified and slow.
            Dealenz is built to be both.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-5xl overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-[0.08em] text-neutral-500">
                <th scope="col" className="px-5 py-4 font-semibold"><span className="sr-only">Capability</span></th>
                <th scope="col" className="px-5 py-4 font-semibold text-neutral-900">Dealenz</th>
                <th scope="col" className="px-5 py-4 font-semibold">Generic AI chat</th>
                <th scope="col" className="px-5 py-4 font-semibold">Manual review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="px-5 py-4 text-[13px] font-semibold text-neutral-900">{r.label}</th>
                  {([r.dealenz, r.generic, r.manual] as const).map((c, i) => (
                    <td key={i} className="px-5 py-4">
                      <span className="flex items-start gap-2 text-[13px] text-neutral-700">
                        {c.ok
                          ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
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

        <p className="mx-auto mt-6 flex max-w-5xl items-start justify-center gap-2 text-center text-[12px] text-neutral-500">
          <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>We publish no customer testimonials or win-rate statistics until real customers consent to them. The table above describes product capabilities, not outcomes.</span>
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            href="/register"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-[13px] font-semibold text-white transition-transform duration-150 hover:bg-neutral-800 active:scale-95"
          >
            Try it on your own contract
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </div>
    </section>
  )
}
