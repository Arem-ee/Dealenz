import type { ReactNode } from "react"

function cx(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

const cardVariants = {
  default: "bg-surface border border-border rounded-xl",
  elevated:
    "bg-surface-elevated border border-border rounded-xl shadow-[0_1px_4px_oklch(0_0_0/0.2)]",
  interactive:
    "bg-surface border border-border rounded-xl transition-all duration-150 hover:bg-surface-hover hover:border-border-subtle cursor-pointer",
}

export function LandingCard({
  variant = "default",
  className,
  children,
}: {
  variant?: keyof typeof cardVariants
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cx(cardVariants[variant], className)}>
      {children}
    </div>
  )
}
