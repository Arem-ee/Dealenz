import Link from "next/link"
import Image from "next/image"
import { Mail } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#07080B] text-white">
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-16 lg:px-8">
        <div className="grid gap-10 border-b border-white/10 pb-16 sm:grid-cols-2 lg:grid-cols-12 lg:gap-12">

          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <div className="relative h-7 w-7 shrink-0 overflow-hidden">
                <Image
                  src="/favicon.svg"
                  alt="Dealenz logo"
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-[17px] font-bold tracking-tight text-white">dealenz</span>
            </div>

            <p className="display-h mt-5 max-w-sm text-[22px] leading-snug text-white">
              Know the risk before you sign.
            </p>

            <div className="mt-6 flex items-center gap-3 text-white/40">
              <a
                href="mailto:dealenz.help@gmail.com"
                className="flex h-9 w-9 items-center justify-center border border-white/10 bg-white/[0.03] transition-colors hover:border-pine-500 hover:text-white"
                aria-label="Email support"
              >
                <Mail className="h-4 w-4" />
              </a>
              <span className="text-[12px] text-white/50">dealenz.help@gmail.com</span>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">By industry</h4>
            <ul className="mt-4 space-y-2.5 text-[13px] text-white/70">
              <li><Link href="/insights/enterprise-tech-saas" className="transition-colors hover:text-white">Enterprise Tech & SaaS</Link></li>
              <li><Link href="/insights/professional-services" className="transition-colors hover:text-white">Professional Services</Link></li>
              <li><Link href="/insights/real-estate-leases" className="transition-colors hover:text-white">Real Estate & Leases</Link></li>
              <li><Link href="/insights/venture-partnerships" className="transition-colors hover:text-white">Venture & Partnerships</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Platform</h4>
            <ul className="mt-4 space-y-2.5 text-[13px] text-white/70">
              <li><Link href="/#workflows" className="transition-colors hover:text-white">Intake & Review</Link></li>
              <li><Link href="/#solutions" className="transition-colors hover:text-white">Deterministic Rules</Link></li>
              <li><Link href="/#platform" className="transition-colors hover:text-white">Counterparty E-Sign</Link></li>
              <li><Link href="/pricing" className="transition-colors hover:text-white">Pricing & Credits</Link></li>
              <li><Link href="/status" className="transition-colors hover:text-white">Status</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Resources</h4>
            <ul className="mt-4 space-y-2.5 text-[13px] text-white/70">
              <li><Link href="/methodology" className="transition-colors hover:text-white">Methodology & Rules</Link></li>
              <li><Link href="/help" className="transition-colors hover:text-white">Help & Knowledgebase</Link></li>
              <li><Link href="/pricing#faq" className="transition-colors hover:text-white">Frequently Asked</Link></li>
              <li><Link href="/security" className="transition-colors hover:text-white">Security</Link></li>
              <li><Link href="/dpa" className="transition-colors hover:text-white">DPA</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Company</h4>
            <ul className="mt-4 space-y-2.5 text-[13px] text-white/70">
              <li><Link href="/login" className="transition-colors hover:text-white">Client Console</Link></li>
              <li><Link href="/register" className="transition-colors hover:text-white">Create Account</Link></li>
              <li><Link href="/privacy" className="transition-colors hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/terms" className="transition-colors hover:text-white">Terms of Service</Link></li>
              <li><Link href="/terms-policies" className="transition-colors hover:text-white">Terms & Policies Directory</Link></li>
            </ul>
          </div>

        </div>

        <div className="pt-8">
          <p className="max-w-4xl text-[11px] leading-relaxed text-white/40">
            Dealenz provides automated contract intelligence, deterministic rule verification, and negotiation drafting recommendations. Dealenz is not a law firm, does not provide legal advice, and does not create an attorney-client relationship. For complex, high-value, or regulated transactions, review final agreements with qualified legal counsel.
          </p>

          <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center text-[12px] text-white/40">
            <p>© 2026 Dealenz Inc. All rights reserved. Know the risk before you sign.</p>
            <p>EU Hosted · AES-256 Encryption</p>
          </div>
        </div>

      </div>

      <div
        className="pointer-events-none select-none text-center font-extrabold uppercase tracking-tight text-white/[0.04] text-[18vw] leading-none -mb-[4vw]"
        aria-hidden="true"
      >
        DEALENZ
      </div>
    </footer>
  )
}
