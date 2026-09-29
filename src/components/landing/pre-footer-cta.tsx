import React from "react"
import Link from "next/link"
import { ArrowRight, ShieldCheck, Lock, CheckCircle2 } from "lucide-react"

export function PreFooterCta() {
  return (
    <section className="relative overflow-hidden bg-[#0A0D14] py-24 text-center text-white lg:py-32">
      {/* Ambient warm radial backlight */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[450px] w-[750px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.12] blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 lg:px-8">
        
        {/* Eyebrow */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
          Zero-Friction Enterprise Intake
        </span>

        {/* Headline */}
        <h2 className="mx-auto mt-6 max-w-2xl text-[34px] font-bold tracking-tight text-white sm:text-[48px] sm:leading-[1.1]">
          Stop managing contracts. <br className="hidden sm:inline" />
          Start leveraging them.
        </h2>

        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-white/70 sm:text-[17px]">
          Upload their paper. Uncover every hidden liability, get exact pushback words in seconds,
          and protect your business with institutional rigor.
        </p>

        {/* Dual Buttons */}
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-[14px] font-bold text-neutral-950 shadow-xl transition-all duration-150 hover:bg-neutral-100 hover:scale-105 active:scale-95"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-7 text-[14px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Sign In to Console
          </Link>
        </div>

        <p className="mt-4 text-[12px] text-white/50">
          10 free credits granted on registration · No credit card required
        </p>

        {/* Security & Compliance Badges Bar */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 border-t border-white/10 pt-8 text-[12px] font-semibold text-white/60">
          <div className="flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-amber-400" />
            <span>AES-256 encryption</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>SOC 2 Type II in progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-blue-400" />
            <span>EU Data Residency & GDPR</span>
          </div>
        </div>

      </div>
    </section>
  )
}
