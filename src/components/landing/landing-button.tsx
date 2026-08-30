import type { ReactNode } from "react"
import Link from "next/link"

function cx(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

interface ButtonProps {
  variant?: "primary" | "secondary" | "text"
  href?: string
  className?: string
  children: ReactNode
}

const base =
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer select-none"

const variants = {
  primary:
    "bg-brand-red text-white hover:bg-brand-red-hover px-6 py-2.5 active:scale-[0.97]",
  secondary:
    "bg-surface border border-border text-foreground hover:bg-surface-hover px-6 py-2.5 active:scale-[0.97]",
  text: "text-text-secondary hover:text-foreground px-2 py-1",
}

export function LandingButton({
  variant = "primary",
  href,
  className,
  children,
}: ButtonProps) {
  if (href) {
    return (
      <Link href={href} className={cx(base, variants[variant], className)}>
        {children}
      </Link>
    )
  }
  return (
    <button className={cx(base, variants[variant], className)}>
      {children}
    </button>
  )
}
