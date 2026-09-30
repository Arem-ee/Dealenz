"use client"

import { useState } from "react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { Menu, X, ArrowRight, ChevronDown } from "lucide-react"

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: "/#platform", label: "Platform" },
    { href: "/#workflows", label: "Workflows" },
    { href: "/pricing", label: "Pricing" },
    { href: "/pricing#faq", label: "FAQ" },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 lg:px-8">
        <Link href="/" aria-label="Dealenz Home">
          <Logo dark size="md" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary Navigation">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-center gap-1 text-[13px] font-medium text-white/70 transition-colors duration-150 hover:text-white"
            >
              {link.label}
              {(link.label === "Platform" || link.label === "Workflows") && (
                <ChevronDown className="h-3 w-3 text-white/40" aria-hidden />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-[13px] font-medium text-white/70 transition-colors hover:text-white sm:inline-block"
          >
            Sign in
          </Link>

          <Link href="/register" className="btn-paper h-9 px-5 text-[13px]">
            <span>Start Free</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-none border border-white/15 text-white/80 transition-colors hover:bg-white/10 md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-b border-white/10 bg-ink px-6 py-6 md:hidden">
          <div className="flex flex-col space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-[15px] font-semibold text-white/80 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-white/10 pt-4">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-[14px] font-semibold text-white/70"
              >
                Sign in to console
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
