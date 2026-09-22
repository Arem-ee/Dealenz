"use client"

import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { backTargetFor } from "@/lib/nav"

/**
 * Slim back bar for one-level-deep routes (today: /chat/[id]). Section roots
 * rely on the sidebar; Document Reader and Review keep their own smarter
 * thread-aware back links, so this renders only where backTargetFor allows.
 */
export function BackBar() {
  const pathname = usePathname()
  const router = useRouter()
  const fallback = backTargetFor(pathname)
  if (!fallback) return null

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }

  return (
    <div className="shrink-0 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="flex h-10 items-center px-3 sm:px-4">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          title="Back"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
