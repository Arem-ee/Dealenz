import React from "react"

interface CircuitBackdropProps {
  variant?: "hero" | "integrations" | "subtle"
  className?: string
}

const TRACE = "#F59E0B"

export function CircuitBackdrop({ variant = "hero", className = "" }: CircuitBackdropProps) {
  if (variant === "integrations") {
    return (
      <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
        <svg
          className="absolute inset-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 600"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M 50 300 H 260 L 320 250 H 520 L 600 270 L 680 250 H 880 L 940 300 H 1150"
            stroke={TRACE}
            strokeOpacity="0.28"
            strokeWidth="1.5"
          />
          <path
            d="M 120 330 H 300 L 360 360 H 540 L 600 330 L 660 360 H 840 L 900 330 H 1080"
            stroke={TRACE}
            strokeOpacity="0.18"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <path d="M 220 180 V 300" stroke={TRACE} strokeOpacity="0.2" strokeWidth="1" />
          <path d="M 400 160 V 250" stroke={TRACE} strokeOpacity="0.2" strokeWidth="1" />
          <path d="M 800 160 V 250" stroke={TRACE} strokeOpacity="0.2" strokeWidth="1" />
          <path d="M 980 180 V 300" stroke={TRACE} strokeOpacity="0.2" strokeWidth="1" />
          <circle cx="320" cy="250" r="3" fill={TRACE} fillOpacity="0.7" />
          <circle cx="600" cy="270" r="4" fill={TRACE} fillOpacity="0.7" />
          <circle cx="880" cy="250" r="3" fill={TRACE} fillOpacity="0.7" />
          <circle cx="260" cy="300" r="2.5" fill={TRACE} fillOpacity="0.5" />
          <circle cx="940" cy="300" r="2.5" fill={TRACE} fillOpacity="0.5" />
        </svg>
      </div>
    )
  }

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M -50 220 C 150 180, 240 320, 420 280 S 600 360, 720 340"
          stroke={TRACE}
          strokeOpacity="0.25"
          strokeWidth="1.25"
        />
        <path
          d="M 1490 220 C 1290 180, 1200 320, 1020 280 S 840 360, 720 340"
          stroke={TRACE}
          strokeOpacity="0.25"
          strokeWidth="1.25"
        />
        <path
          d="M 180 80 L 260 160 H 460 L 520 220"
          stroke={TRACE}
          strokeOpacity="0.18"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <path
          d="M 1260 80 L 1180 160 H 980 L 920 220"
          stroke={TRACE}
          strokeOpacity="0.18"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <path
          d="M 720 340 V 520"
          stroke={TRACE}
          strokeOpacity="0.25"
          strokeWidth="1.25"
        />
        <circle cx="260" cy="160" r="2.5" fill={TRACE} fillOpacity="0.6" />
        <circle cx="420" cy="280" r="3" fill={TRACE} fillOpacity="0.6" />
        <circle cx="520" cy="220" r="2.5" fill={TRACE} fillOpacity="0.6" />
        <circle cx="720" cy="340" r="4" fill={TRACE} fillOpacity="0.7" />
        <circle cx="920" cy="220" r="2.5" fill={TRACE} fillOpacity="0.6" />
        <circle cx="1020" cy="280" r="3" fill={TRACE} fillOpacity="0.6" />
        <circle cx="1180" cy="160" r="2.5" fill={TRACE} fillOpacity="0.6" />
      </svg>
    </div>
  )
}
