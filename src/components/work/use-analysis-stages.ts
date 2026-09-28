"use client"

import { useEffect, useState } from "react"
import type { AnalysisStage } from "@/lib/analysis/stages"

const STAGE_POLL_MS = 2500
const STAGE_POLL_MAX = 120

/**
 * Live analysis-stage feed for one audit. Polls the ownership-checked stage
 * action while `active`, otherwise holds null. Every failure mode keeps the
 * last stages (or nothing) — progress is best-effort decoration, never load
 * bearing, so callers render it only when it carries signal.
 */
export function useAnalysisStages(auditId: string | null | undefined, active: boolean): AnalysisStage[] | null {
  const [stages, setStages] = useState<AnalysisStage[] | null>(null)

  useEffect(() => {
    if (!active || !auditId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale stages when the run ends is intentional
      setStages(null)
      return
    }
    let cancelled = false
    let polls = 0
    let inflight = false
    let timer: ReturnType<typeof setInterval> | null = null
    const tick = async () => {
      // Stop the interval itself at the cap (not just no-op): a leaked
      // 2.5s timer firing forever is a slow battery/memory bleed. Skip while
      // a previous poll is still in flight so slow reads never overlap.
      if (cancelled || inflight) return
      if (polls >= STAGE_POLL_MAX) {
        if (timer) clearInterval(timer)
        return
      }
      polls += 1
      inflight = true
      try {
        const { getAnalysisStages } = await import("@/app/audit/[id]/stages")
        const res = await getAnalysisStages(auditId)
        if (!cancelled && res.ok) setStages(res.stages)
      } catch {
        // Best-effort: a failed poll keeps the last stages (or nothing).
      } finally {
        inflight = false
      }
    }
    void tick()
    timer = setInterval(() => void tick(), STAGE_POLL_MS)
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [active, auditId])

  return stages
}
