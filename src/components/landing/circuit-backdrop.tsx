import React from "react"

interface CircuitBackdropProps {
  variant?: "hero" | "integrations" | "subtle"
  className?: string
}

export function CircuitBackdrop({ variant = "hero", className = "" }: CircuitBackdropProps) {
  if (variant === "integrations") {
    return (
      <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
        {/* Ambient radial glow */}
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.08] blur-[120px]" />
        
        {/* Flowing integration circuit SVG */}
        <svg
          className="absolute inset-0 h-full w-full stroke-amber-500/30"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 600"
          fill="none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="amberCircuitGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.1" />
              <stop offset="35%" stopColor="#F59E0B" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#FBBF24" stopOpacity="0.9" />
              <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.1" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Main sweeping bus lines connecting tools */}
          <path
            d="M 50 300 H 260 L 320 250 H 520 L 600 270 L 680 250 H 880 L 940 300 H 1150"
            stroke="url(#amberCircuitGlow)"
            strokeWidth="1.75"
            filter="url(#glow)"
          />
          <path
            d="M 120 330 H 300 L 360 360 H 540 L 600 330 L 660 360 H 840 L 900 330 H 1080"
            stroke="#F59E0B"
            strokeOpacity="0.25"
            strokeWidth="1.25"
            strokeDasharray="4 4"
          />

          {/* Vertical drop pins */}
          <path d="M 220 180 V 300" stroke="#F59E0B" strokeOpacity="0.3" strokeWidth="1" />
          <path d="M 400 160 V 250" stroke="#F59E0B" strokeOpacity="0.3" strokeWidth="1" />
          <path d="M 800 160 V 250" stroke="#F59E0B" strokeOpacity="0.3" strokeWidth="1" />
          <path d="M 980 180 V 300" stroke="#F59E0B" strokeOpacity="0.3" strokeWidth="1" />

          {/* Glowing junction nodes */}
          <circle cx="320" cy="250" r="3.5" fill="#FBBF24" filter="url(#glow)" />
          <circle cx="600" cy="270" r="5" fill="#FBBF24" filter="url(#glow)" />
          <circle cx="880" cy="250" r="3.5" fill="#FBBF24" filter="url(#glow)" />
          <circle cx="260" cy="300" r="3" fill="#F59E0B" />
          <circle cx="940" cy="300" r="3" fill="#F59E0B" />
        </svg>
      </div>
    )
  }

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {/* Top warm radial background glow */}
      <div className="absolute left-1/2 top-0 h-[650px] w-[1100px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-gradient-to-b from-amber-500/[0.12] via-orange-500/[0.04] to-transparent blur-[140px]" />

      {/* Hero Circuit Network Traces */}
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="heroCircuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.05" />
            <stop offset="30%" stopColor="#F59E0B" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#FBBF24" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#EA580C" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.05" />
          </linearGradient>

          <filter id="circuitGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Primary Arching Constellation Trace Left */}
        <path
          d="M -50 220 C 150 180, 240 320, 420 280 S 600 360, 720 340"
          stroke="url(#heroCircuitGrad)"
          strokeWidth="1.5"
          filter="url(#circuitGlow)"
        />

        {/* Primary Arching Constellation Trace Right */}
        <path
          d="M 1490 220 C 1290 180, 1200 320, 1020 280 S 840 360, 720 340"
          stroke="url(#heroCircuitGrad)"
          strokeWidth="1.5"
          filter="url(#circuitGlow)"
        />

        {/* Secondary Grid Hairlines */}
        <path
          d="M 180 80 L 260 160 H 460 L 520 220"
          stroke="#F59E0B"
          strokeOpacity="0.22"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <path
          d="M 1260 80 L 1180 160 H 980 L 920 220"
          stroke="#F59E0B"
          strokeOpacity="0.22"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Center Descending Anchor Line towards Product Card */}
        <path
          d="M 720 340 V 520"
          stroke="url(#heroCircuitGrad)"
          strokeWidth="1.5"
          filter="url(#circuitGlow)"
        />

        {/* Constellation Nodes & Diamond Glyphs */}
        <g filter="url(#circuitGlow)">
          <circle cx="260" cy="160" r="3" fill="#FBBF24" />
          <circle cx="420" cy="280" r="4" fill="#F59E0B" />
          <circle cx="520" cy="220" r="3" fill="#FBBF24" />
          <circle cx="720" cy="340" r="5" fill="#FDE68A" />
          <circle cx="920" cy="220" r="3" fill="#FBBF24" />
          <circle cx="1020" cy="280" r="4" fill="#F59E0B" />
          <circle cx="1180" cy="160" r="3" fill="#FBBF24" />

          {/* Micro diamonds */}
          <polygon points="420,275 425,280 420,285 415,280" fill="#FBBF24" />
          <polygon points="1020,275 1025,280 1020,285 1015,280" fill="#FBBF24" />
          <polygon points="720,333 727,340 720,347 713,340" fill="#FFFBEB" />
        </g>
      </svg>
    </div>
  )
}
