import React from "react"
import { cn } from "@/lib/utils"

interface IconProps {
  className?: string
  "data-numeric"?: boolean
}

function Icon({ children, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      {children}
    </svg>
  )
}

export function IconDeal({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13l2 2 4-4" />
    </Icon>
  )
}

export function IconRiskFlag({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 21V4c0-1 1-2 2-2h13c1 0 1.5 1.2.8 2L18 7l1.8 3c.7.8.2 2-.8 2H6" />
      <circle cx="12" cy="11" r="1" fill="currentColor" />
      <line x1="12" y1="7" x2="12" y2="9" />
    </Icon>
  )
}

export function IconContract({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
      <path d="M16 19h2" />
    </Icon>
  )
}

export function IconSow({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </Icon>
  )
}

export function IconClient({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
      <circle cx="12" cy="7" r="1" fill="currentColor" />
    </Icon>
  )
}

export function IconProposal({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <polygon points="12 11 13.2 13.5 16 13.8 14 15.7 14.4 18.5 12 17.2 9.6 18.5 10 15.7 8 13.8 10.8 13.5" />
    </Icon>
  )
}

export function IconChecklist({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="12" x2="11" y2="14" />
      <line x1="11" y1="14" x2="15" y2="10" />
    </Icon>
  )
}

export function IconSeverityLow({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      <circle cx="12" cy="12" r="6" />
    </svg>
  )
}

export function IconSeverityMedium({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      <path d="M12 3l9 16H3z" />
      <line x1="12" y1="10" x2="12" y2="13" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" />
    </svg>
  )
}

export function IconSeverityHigh({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      <path d="M12 2l10 10-10 10L2 12z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" />
    </svg>
  )
}

export function IconSeverityCritical({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <circle cx="12" cy="15" r="0.5" fill="currentColor" />
    </svg>
  )
}

export function IconPipeline({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3" y="3" width="18" height="4" rx="1" />
      <rect x="3" y="10" width="18" height="4" rx="1" />
      <rect x="3" y="17" width="18" height="4" rx="1" />
    </Icon>
  )
}

export function IconTemplate({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="4" rx="1" />
      <rect x="14" y="10" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="3" rx="1" />
    </Icon>
  )
}
