"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface AnimateInProps {
  children: React.ReactNode
  animation?: "fade-in" | "fade-in-up" | "scale-in" | "stagger"
  className?: string
}

export function AnimateIn({
  children,
  animation = "fade-in-up",
  className,
}: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        visible && animation === "stagger" ? "animate-stagger" : "",
        visible && animation !== "stagger" ? `animate-${animation}` : "opacity-0",
        className
      )}
    >
      {children}
    </div>
  )
}
