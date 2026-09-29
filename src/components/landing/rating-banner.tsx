import React from "react"
import Link from "next/link"
import { ArrowRight, ShieldCheck, Layers, Cpu } from "lucide-react"

export function RatingBanner() {
  return (
    <section className="relative overflow-hidden bg-white py-20 text-neutral-900 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          
          {/* Left Column: Copy & Value Proposition */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-900">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
              <span>DETERMINISTIC VERIFICATION ARCHITECTURE</span>
            </div>

            <h2 className="mt-4 text-[30px] font-bold tracking-tight text-neutral-900 sm:text-[42px] sm:leading-[1.1]">
              Contract & Deal Intelligence engineered for certainty.
            </h2>

            <p className="mt-4 text-[15px] leading-relaxed text-neutral-600 sm:text-[16px]">
              Generic chatbots guess and invent legal conclusions. Dealenz couples frontier model intelligence
              with hard-coded, deterministic rulepacks codified from thousands of commercial transactions.
              Where the AI and institutional rules disagree, <strong>the rules win</strong>.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                href="/methodology"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-[13px] font-semibold text-white transition-transform duration-150 hover:bg-neutral-800 active:scale-95"
              >
                Read Our Methodology
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-[12px] font-medium text-neutral-500">
                100% Deterministic Rulepack Transparency
              </span>
            </div>

            {/* Architectural Highlights */}
            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-neutral-200 pt-6">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-700">
                  <Layers className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-[13px] font-bold text-neutral-900">Modular Rulepacks</h4>
                  <p className="text-[11px] text-neutral-500">Delaware, Common Law, CAMA & cross-border playbooks.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-700">
                  <Cpu className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-[13px] font-bold text-neutral-900">Advisory Locks</h4>
                  <p className="text-[11px] text-neutral-500">Cryptographically verifiable evidence grounding.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Isometric Wireframe Graphic */}
          <div className="flex justify-center lg:col-span-6">
            <div className="relative h-[340px] w-full max-w-[420px] sm:h-[400px]">
              
              {/* Subtle warm glow behind isometric cube */}
              <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.15] blur-[80px]" />

              {/* Precision SVG Isometric 3D Wireframe Cube with Glowing Nodes */}
              <svg
                viewBox="0 0 400 400"
                className="h-full w-full drop-shadow-2xl"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="cubeOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#EA580C" />
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#FBBF24" />
                  </linearGradient>
                  
                  <linearGradient id="faceGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#EA580C" stopOpacity="0.05" />
                  </linearGradient>

                  <filter id="cubeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Isometric Lattice Network Grid Lines */}
                <g stroke="#F59E0B" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3">
                  <path d="M 200 60 L 320 130 L 320 270 L 200 340 L 80 270 L 80 130 Z" />
                  <path d="M 200 60 L 200 200 L 320 270" />
                  <path d="M 200 200 L 80 270" />
                  <path d="M 50 180 L 200 90 L 350 180" />
                  <path d="M 200 370 V 200" />
                </g>

                {/* Main Foreground 3D Isometric Cube Faces */}
                {/* Top Face */}
                <polygon
                  points="200,100 290,150 200,200 110,150"
                  fill="url(#faceGrad1)"
                  stroke="url(#cubeOrangeGrad)"
                  strokeWidth="2.5"
                  filter="url(#cubeGlow)"
                />
                
                {/* Left Face */}
                <polygon
                  points="110,150 200,200 200,300 110,250"
                  fill="#F59E0B"
                  fillOpacity="0.08"
                  stroke="url(#cubeOrangeGrad)"
                  strokeWidth="2.5"
                  filter="url(#cubeGlow)"
                />

                {/* Right Face */}
                <polygon
                  points="200,200 290,150 290,250 200,300"
                  fill="#EA580C"
                  fillOpacity="0.12"
                  stroke="url(#cubeOrangeGrad)"
                  strokeWidth="2.5"
                  filter="url(#cubeGlow)"
                />

                {/* Inner Geometric Grid Ribs inside Cube */}
                <path d="M 155 125 L 245 175" stroke="#FBBF24" strokeWidth="1.5" strokeOpacity="0.7" />
                <path d="M 245 125 L 155 175" stroke="#FBBF24" strokeWidth="1.5" strokeOpacity="0.7" />
                <path d="M 155 175 V 275" stroke="#FBBF24" strokeWidth="1.5" strokeOpacity="0.7" />
                <path d="M 245 175 V 275" stroke="#FBBF24" strokeWidth="1.5" strokeOpacity="0.7" />

                {/* Orbiting Satellite Sub-Cubes */}
                {/* Upper Right Sub-cube */}
                <g transform="translate(60, -30) scale(0.45)">
                  <polygon points="200,100 290,150 200,200 110,150" fill="#F59E0B" fillOpacity="0.2" stroke="#F59E0B" strokeWidth="2" />
                  <polygon points="110,150 200,200 200,300 110,250" fill="#EA580C" fillOpacity="0.1" stroke="#F59E0B" strokeWidth="2" />
                  <polygon points="200,200 290,150 290,250 200,300" fill="#F59E0B" fillOpacity="0.15" stroke="#F59E0B" strokeWidth="2" />
                </g>

                {/* Lower Left Sub-cube */}
                <g transform="translate(-50, 60) scale(0.4)">
                  <polygon points="200,100 290,150 200,200 110,150" fill="#F59E0B" fillOpacity="0.2" stroke="#F59E0B" strokeWidth="2" />
                  <polygon points="110,150 200,200 200,300 110,250" fill="#EA580C" fillOpacity="0.1" stroke="#F59E0B" strokeWidth="2" />
                  <polygon points="200,200 290,150 290,250 200,300" fill="#F59E0B" fillOpacity="0.15" stroke="#F59E0B" strokeWidth="2" />
                </g>

                {/* Glowing Vertices & Decision Nodes */}
                <g filter="url(#cubeGlow)">
                  <circle cx="200" cy="100" r="4.5" fill="#FFFBEB" />
                  <circle cx="290" cy="150" r="4.5" fill="#FDE68A" />
                  <circle cx="110" cy="150" r="4.5" fill="#FDE68A" />
                  <circle cx="200" cy="200" r="6" fill="#FBBF24" />
                  <circle cx="200" cy="300" r="4.5" fill="#F59E0B" />
                  <circle cx="110" cy="250" r="4" fill="#EA580C" />
                  <circle cx="290" cy="250" r="4" fill="#EA580C" />
                </g>

                {/* Center Core Glyph representing Dealenz Rulepack Engine */}
                <circle cx="200" cy="200" r="16" fill="#1C1917" stroke="#FBBF24" strokeWidth="2" />
                <text x="200" y="204" textAnchor="middle" fill="#FBBF24" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  §DZ
                </text>
              </svg>

            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
