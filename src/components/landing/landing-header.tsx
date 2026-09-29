"use client"

import { useState } from "react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { Menu, X, ArrowRight } from "lucide-react"

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: "/#platform", label: "Platform" },
    { href: "/#solutions", label: "Solutions" },
    { href: "/#workflows", label: "Workflows" },
    { href: "/#integrations", label: "Integrations" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/#faq", label: "FAQ" },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090A0E]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 lg:px-8">
        
        {/* Left: Brand Logo */}
        <Link href="/" aria-label="Dealenz Home">
          <Logo dark showSubtitle size="md" />
        </Link>

        {/* Center: Desktop Nav Links */}
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary Navigation">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[13px] font-medium text-white/70 transition-colors duration-150 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-[13px] font-medium text-white/70 transition-colors hover:text-white sm:inline-block"
          >
            Sign in
          </Link>

          <Link
            href="/register"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-5 text-[13px] font-bold text-neutral-950 transition-all duration-150 hover:bg-neutral-100 hover:scale-105 active:scale-95"
          >
            <span>Start Free</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-white/80 transition-colors hover:bg-white/10 md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-white/10 bg-[#0C0E14] px-6 py-6 md:hidden">
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
