"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

const MIN_PANE_PX = 280
const MIN_PANEL_PX = 320

/** True on desktop-width viewports. Split panes only render side-by-side here;
 * narrow viewports always get the stacked (mobile) layout. */
export function useIsDesktop(breakpointPx = 1024): boolean {
  const get = useCallback(() => {
    if (typeof window === "undefined") return false
    return window.innerWidth >= breakpointPx
  }, [breakpointPx])
  // Start narrow (matches SSR) and resolve on mount to avoid hydration mismatch.
  const [desktop, setDesktop] = useState<boolean>(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- viewport can only be measured client-side after mount
    setDesktop(get())
    const onResize = () => setDesktop(get())
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [get])
  return desktop
}

function storageKey(userId: string | null, paneKey: string): string {
  return `dealenz:split:${paneKey}:${userId ?? "anon"}`
}

function readSplit(userId: string | null, paneKey: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey(userId, paneKey))
    if (!raw) return null
    const v = Number(raw)
    return Number.isFinite(v) && v > 0 && v < 1 ? v : null
  } catch {
    return null
  }
}

/**
 * Resizable horizontal split. `primary` is the conversation side, `panel` the
 * structured-content side. Fraction persists per user so the choice survives
 * visits. Below the desktop breakpoint the panes stack (panel first when
 * `stackPanelFirst`).
 */
export function SplitPane({
  userId,
  paneKey,
  primary,
  panel,
  defaultSplit = 0.42,
  stackPanelFirst = false,
  className,
}: {
  userId: string | null
  paneKey: string
  primary: ReactNode
  panel: ReactNode
  defaultSplit?: number
  stackPanelFirst?: boolean
  className?: string
}) {
  const [fraction, setFraction] = useState<number>(defaultSplit)
  const [hydrated, setHydrated] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- persisted split must load after mount (localStorage is client-only); SSR renders the default
    setFraction(readSplit(userId, paneKey) ?? defaultSplit)
    setHydrated(true)
  }, [userId, paneKey, defaultSplit])

  const persist = useCallback(
    (v: number) => {
      setFraction(v)
      try {
        localStorage.setItem(storageKey(userId, paneKey), String(v))
      } catch {
        // Persistence is a preference, never a failure.
      }
    },
    [userId, paneKey]
  )

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    e.preventDefault()
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width <= 0) return
      const raw = (e.clientX - rect.left) / rect.width
      const minFrac = MIN_PANE_PX / rect.width
      const maxFrac = 1 - MIN_PANEL_PX / rect.width
      if (maxFrac <= minFrac) return
      persist(Math.min(maxFrac, Math.max(minFrac, raw)))
    }
    const onUp = () => {
      draggingRef.current = false
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [persist])

  return (
    <div ref={containerRef} className={cn("flex min-h-0 flex-1 flex-col lg:flex-row", className)}>
      <div
        className={cn("flex min-h-0 min-w-0 flex-1 flex-col", stackPanelFirst && "order-2 lg:order-1")}
        style={hydrated ? { flexGrow: 0, flexShrink: 0, flexBasis: `${fraction * 100}%` } : undefined}
      >
        {primary}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        onPointerDown={onPointerDown}
        className="hidden shrink-0 cursor-col-resize items-stretch px-1 lg:flex"
      >
        <div className="w-px bg-border transition-colors hover:bg-primary/40" />
      </div>
      <div
        className={cn("flex min-h-0 min-w-0 flex-1 flex-col border-t lg:border-l lg:border-t-0", stackPanelFirst && "order-1 lg:order-2")}
      >
        {panel}
      </div>
    </div>
  )
}
