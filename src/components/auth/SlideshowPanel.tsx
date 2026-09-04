"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface Slide {
  headline: string
  supporting: string
}

const slides = [
  {
    headline: "Know the risk before you sign.",
    supporting: "Paste any deal and get a real, honest risk report in minutes."
  },
  {
    headline: "Not just a red flag.",
    supporting: "Dealenz suggests better terms, ones that actually work for both sides of the deal."
  },
  {
    headline: "For founders too.",
    supporting: "Term sheets, co-founder agreements, vendor contracts, anything you're about to sign."
  }
] satisfies Slide[]

export function SlideshowPanel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [paused])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
    setPaused(true)
    setTimeout(() => setPaused(false), 8000)
  }

  return (
    <div className="relative w-full max-w-xl">
      <div
        className="relative overflow-hidden"
        style={{ minHeight: "180px" }}
      >
        {slides.map((slide, index) => (
          <div
            key={index}
            className={cn(
              "absolute inset-0 transition-all duration-500 ease-in-out",
              index === currentSlide
                ? "opacity-100 translate-x-0"
                : index < currentSlide
                ? "-translate-x-full opacity-0"
                : "translate-x-full opacity-0"
            )}
          >
            <h3 className="font-extrabold text-3xl lg:text-4xl leading-[1.05] text-white mb-3">
              {slide.headline}
            </h3>
            <p className="text-white/70 text-sm max-w-xs">
              {slide.supporting}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-center gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              index === currentSlide
                ? "bg-white scale-125"
                : "bg-white/40 hover:bg-white/60"
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}