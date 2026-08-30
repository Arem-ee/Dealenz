export const SPACING = [8, 16, 24, 32, 40, 48, 64, 80, 96] as const

export const MAX_WIDTHS = {
  narrow: "max-w-[720px]",
  medium: "max-w-[960px]",
  wide: "max-w-[1120px]",
} as const

export const SECTION_PADDING = {
  default: "py-16 sm:py-24",
  compact: "py-10 sm:py-16",
  spacious: "py-20 sm:py-32",
} as const
