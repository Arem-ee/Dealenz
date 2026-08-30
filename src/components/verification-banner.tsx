"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"

export function VerificationBanner() {
  const searchParams = useSearchParams()
  const visible = searchParams.get("verify") === "true"
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        window.history.replaceState({}, "", window.location.pathname)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div ref={bannerRef} className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
      <p className="text-blue-700">Please check your email for the verification link.</p>
    </div>
  )
}
