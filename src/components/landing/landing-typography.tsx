import type { ReactNode } from "react"

function cx(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

export function DisplayLarge({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <h1
      className={cx(
        "text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1] text-foreground",
        className,
      )}
    >
      {children}
    </h1>
  )
}

export function DisplayMedium({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <h2
      className={cx(
        "text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.15] text-foreground",
        className,
      )}
    >
      {children}
    </h2>
  )
}

export function HeadingLarge({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <h3
      className={cx(
        "text-2xl sm:text-3xl font-semibold tracking-tight leading-[1.2] text-foreground",
        className,
      )}
    >
      {children}
    </h3>
  )
}

export function HeadingMedium({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <h4
      className={cx(
        "text-xl sm:text-2xl font-medium tracking-tight leading-[1.25] text-foreground",
        className,
      )}
    >
      {children}
    </h4>
  )
}

export function Body({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <p className={cx("text-base leading-relaxed text-text-secondary", className)}>
      {children}
    </p>
  )
}

export function BodySmall({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <p className={cx("text-sm leading-relaxed text-text-secondary", className)}>
      {children}
    </p>
  )
}

export function Caption({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <p className={cx("text-xs leading-relaxed text-text-muted", className)}>
      {children}
    </p>
  )
}
