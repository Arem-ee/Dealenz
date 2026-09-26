"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
]

/**
 * Mobile-only hamburger for the marketing nav. The screen is slim, so the
 * anchor links and sign-in collapse into a dropdown; the signup CTA stays
 * visible beside it.
 */
export function LandingMobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-muted/80 hover:text-foreground"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <nav
            aria-label="Mobile"
            className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_48px_-16px_rgba(0,0,0,0.25)]"
          >
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block border-t border-border/60 px-4 py-3 text-sm font-medium text-foreground"
            >
              Sign in
            </Link>
          </nav>
        </>
      )}
    </div>
  )
}
