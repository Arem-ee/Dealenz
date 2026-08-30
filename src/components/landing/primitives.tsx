import type { ReactNode } from "react"
import Link from "next/link"

function cx(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

const widthMap = {
  narrow: "max-w-[480px]",
  medium: "max-w-[720px]",
  wide: "max-w-[800px]",
  xwide: "max-w-[1200px]",
} as const

const paddingMap = {
  default: "py-20 sm:py-28",
  compact: "py-14 sm:py-20",
  spacious: "py-24 sm:py-32",
  minimal: "py-10 sm:py-12",
} as const

export function SectionWrapper({
  width = "xwide",
  padding,
  dark,
  noBorder,
  borderTop,
  as: Tag = "section",
  className,
  children,
}: {
  width?: keyof typeof widthMap
  padding?: keyof typeof paddingMap
  dark?: boolean
  noBorder?: boolean
  borderTop?: boolean
  as?: "section" | "footer"
  className?: string
  children: ReactNode
}) {
  const pad = padding ? paddingMap[padding] : ""
  return (
    <Tag
      className={cx(
        dark ? "bg-[#0d0d0d] text-[#f0f0f0]" : "bg-background",
        !dark && !noBorder && !borderTop && "border-b border-border/70",
        borderTop && "border-t border-border/70",
        className,
      )}
    >
      <div className={cx("mx-auto px-4 sm:px-6", widthMap[width], pad)}>
        {children}
      </div>
    </Tag>
  )
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
      {children}
    </h2>
  )
}

export function BodyText({
  variant = "body",
  muted = true,
  mono,
  className,
  children,
}: {
  variant?: "body" | "small" | "large"
  muted?: boolean
  mono?: boolean
  className?: string
  children: ReactNode
}) {
  const base = cx(
    mono && "font-mono",
    variant === "body" && "text-sm sm:text-base leading-relaxed",
    variant === "large" && "text-base sm:text-lg leading-relaxed",
    variant === "small" && "text-xs leading-relaxed",
    muted ? "text-muted-foreground" : "text-foreground",
    className,
  )
  return <p className={base}>{children}</p>
}

export function CTAButton({
  variant = "primary",
  href,
  className,
  children,
}: {
  variant?: "primary" | "secondary" | "text"
  href: string
  className?: string
  children: ReactNode
}) {
  const base = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors"
  const styles = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5",
    secondary: "border border-[#333] text-[#a0a0a0] hover:text-[#f0f0f0] hover:border-[#555] px-6 py-2.5",
    text: "text-muted-foreground hover:text-foreground",
  }
  return (
    <Link href={href} className={cx(base, styles[variant], className)}>
      {children}
    </Link>
  )
}
