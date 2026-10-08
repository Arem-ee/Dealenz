"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

interface WordRevealProps {
  children: ReactNode
  className?: string
  delay?: number
  stagger?: number
}

export function WordReveal({ children, className, delay = 0, stagger = 0.06 }: WordRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const words = useMemo(() => {
    const text = typeof children === "string" ? children.trim() : String(children ?? "").trim()
    return text.split(/\s+/).filter(Boolean)
  }, [children])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: "top 90%",
        once: true,
        onEnter: () => {
          setIsVisible(true)
        },
      })
    }, el)

    return () => ctx.revert()
  }, [])

  if (!isVisible) {
    return (
      <div ref={ref} className={className} aria-hidden="true" style={{ opacity: 0 }}>
        {words.map((w, i) => (
          <span key={i} className="word-reveal-word" style={{ opacity: 0, transform: "translateY(1.2em)" }}>
            {w}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className={className} aria-live="polite">
      {words.map((word, i) => (
        <span
          key={i}
          className="word-reveal-word"
          style={{
            animationDelay: `${delay + i * stagger}s`,
            transitionDelay: `${delay + i * stagger}s`,
          }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}

interface LineRevealProps {
  lines: string[]
  className?: string
  delay?: number
  stagger?: number
}

export function LineReveal({ lines, className, delay = 0, stagger = 0.12 }: LineRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: "top 90%",
        once: true,
        onEnter: () => {
          setIsVisible(true)
        },
      })
    }, el)

    return () => ctx.revert()
  }, [])

  if (!isVisible) {
    return (
      <div ref={ref} className={className} aria-hidden="true" style={{ opacity: 0 }}>
        {lines.map((line, i) => (
          <div key={i} className="line-reveal-line" style={{ opacity: 0, transform: "translateY(1.5em)" }}>
            {line}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className={className} aria-live="polite">
      {lines.map((line, i) => (
        <div
          key={i}
          className="line-reveal-line"
          style={{
            animationDelay: `${delay + i * stagger}s`,
            transitionDelay: `${delay + i * stagger}s`,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}