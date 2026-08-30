import type { ReactNode } from "react"
import { MAX_WIDTHS, SECTION_PADDING } from "./landing-tokens"
import { LandingNavbar } from "./landing-navbar"

function cx(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

export function LandingShell({ children }: { children?: ReactNode }) {
  return (
    <div className="landing-theme min-h-screen bg-background text-foreground font-sans antialiased">
      <LandingNavbar />
      <main>{children}</main>
    </div>
  )
}

export function Section({
  width = "wide",
  padding = "default",
  className,
  children,
}: {
  width?: keyof typeof MAX_WIDTHS
  padding?: keyof typeof SECTION_PADDING
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cx(SECTION_PADDING[padding], className)}>
      <div className={`mx-auto w-full px-6 sm:px-8 ${MAX_WIDTHS[width]}`}>
        {children}
      </div>
    </section>
  )
}

export function SectionHeader({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cx("mb-16 flex flex-col items-center text-center", className)}>
      {children}
    </div>
  )
}
