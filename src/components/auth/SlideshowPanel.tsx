"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface Slide {
  image: string
  alt: string
  headline: string
  supporting: string
}

const slides = [
  {
    image: "/mutual-terms.jpg",
    alt: "Two people reaching agreement over a document",
    headline: "Not just a red flag.",
    supporting: "Dealenz suggests better terms, ones that actually work for both sides of the deal.",
  },
  {
    image: "/hidden-clause.jpg",
    alt: "Highlighted clause in dense document text",
    headline: "Catches what you'd miss.",
    supporting: "Finds the one line hidden in a lot of text.",
  },
  {
    image: "/ask-without-document.jpg",
    alt: "Person asking a question without a document",
    headline: "No document? Just ask.",
    supporting: "You don't need a file to start — ask what to do next.",
  },
  {
    image: "/deal-plan.jpg",
    alt: "Stack of documents forming a plan",
    headline: "Every deal leaves with a plan.",
    supporting: "Not just a warning — the documents you need next.",
  },
  {
    image: "/lawyer-review.jpg",
    alt: "Lawyer reviewing a document with a client",
    headline: "A real lawyer, when it's serious.",
    supporting: "Add a person to review it — only if you want to.",
  },
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
    <div className="relative flex h-full min-h-screen w-full flex-col justify-between overflow-hidden bg-[#FFFBF5]">
      {/* Full-bleed image — edge to edge, top to bottom */}
      {slides.map((slide, index) => (
        <img
          key={slide.image}
          src={slide.image}
          alt={slide.alt}
          className={cn(
            "absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ease-in-out",
            index === currentSlide ? "opacity-100" : "opacity-0"
          )}
          draggable={false}
        />
      ))}

      {/* Light scrims — top for logo, bottom for headline/subtext/dots — light-to-lighter only, not dark */}
      <div
        className="absolute inset-x-0 top-0 h-[18%] bg-gradient-to-b from-[#FFFBF5]/90 via-[#FFFBF5]/55 to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#FFFBF5]/85 via-[#FFFBF5]/45 to-transparent"
        aria-hidden="true"
      />

      {/* Logo — top-left, dark for light panel */}
      <div className="relative z-10 p-12 lg:p-16 pb-0">
        <span className="text-2xl font-semibold tracking-tight text-[#141110]">Dealenz</span>
      </div>

      {/* Bottom block — headline/subtext + dots, overlaying image near bottom */}
      <div className="relative z-10 flex flex-col p-12 lg:p-16 pt-0">
        <div className="relative min-h-[110px] overflow-hidden">
          {slides.map((slide, index) => (
            <div
              key={index}
              className={cn(
                "absolute inset-0 flex flex-col justify-end transition-all duration-500 ease-in-out",
                index === currentSlide
                  ? "opacity-100 translate-x-0"
                  : index < currentSlide
                  ? "-translate-x-full opacity-0"
                  : "translate-x-full opacity-0"
              )}
            >
              <h3 className="font-extrabold text-[1.7rem] lg:text-[1.85rem] leading-[1.05] text-[#141110]">
                {slide.headline}
              </h3>
              <p className="mt-2 text-[#141110]/70 text-[13px] leading-[1.5] max-w-[29ch]">{slide.supporting}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "h-2 w-2 rounded-full transition-all duration-300",
                index === currentSlide
                  ? "bg-[var(--color-primary)] scale-125"
                  : "bg-[#141110]/15 hover:bg-[#141110]/25"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
