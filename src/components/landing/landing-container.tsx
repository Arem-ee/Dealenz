import type { ReactNode } from "react"
import { MAX_WIDTHS } from "./landing-tokens"

export function LandingContainer({
  width = "wide",
  className,
  children,
}: {
  width?: keyof typeof MAX_WIDTHS
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`mx-auto w-full px-6 sm:px-8 ${MAX_WIDTHS[width]} ${className ?? ""}`}>
      {children}
    </div>
  )
}
