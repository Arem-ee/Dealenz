"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

interface TypewriterProps {
  children: ReactNode
  className?: string
  speed?: number
  delay?: number
  onComplete?: () => void
}

export function Typewriter({ children, className, speed = 30, delay = 0, onComplete }: TypewriterProps) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [displayText, setDisplayText] = useState("")
  const [isVisible, setIsVisible] = useState(false)
  const [charIndex, setCharIndex] = useState(0)

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

  useEffect(() => {
    if (!isVisible) return

    const text = String(children).trim()
    let index = 0

    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayText(text.slice(0, index + 1))
          setCharIndex(index)
          index++
        } else {
          clearInterval(interval)
          onComplete?.()
        }
      }, speed)

      return () => clearInterval(interval)
    }, delay)

    return () => clearTimeout(timer)
  }, [isVisible, children, speed, delay, onComplete])

  return (
    <span ref={ref} className={className} aria-live="polite">
      {displayText}
      {isVisible && charIndex < String(children).length - 1 && <span className="typewriter-cursor" aria-hidden="true" />}
    </span>
  )
}

interface MultiLineTypewriterProps {
  lines: string[]
  className?: string
  lineDelay?: number
  charSpeed?: number
  onComplete?: () => void
}

export function MultiLineTypewriter({ lines, className, lineDelay = 400, charSpeed = 25, onComplete }: MultiLineTypewriterProps) {
  const [currentLine, setCurrentLine] = useState(0)
  const [displayText, setDisplayText] = useState("")
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (!isVisible || currentLine >= lines.length) return

    const text = lines[currentLine]
    let index = 0

    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayText(text.slice(0, index + 1))
          index++
        } else {
          clearInterval(interval)
          if (currentLine < lines.length - 1) {
            setTimeout(() => {
              setCurrentLine((prev) => prev + 1)
              setDisplayText("")
            }, lineDelay)
          } else {
            onComplete?.()
          }
        }
      }, charSpeed)

      return () => clearInterval(interval)
    }, currentLine === 0 ? 0 : lineDelay)

    return () => clearTimeout(timer)
  }, [isVisible, currentLine, lines, lineDelay, charSpeed])

  return (
    <div ref={ref} className={className} aria-live="polite">
      {lines.slice(0, currentLine).map((line, i) => (
        <div key={i} className="typewriter-line">
          {line}
        </div>
      ))}
      <div className="typewriter-line">
        {displayText}
        {isVisible && currentLine < lines.length && <span className="typewriter-cursor" aria-hidden="true" />}
      </div>
    </div>
  )
}