"use client"

import { useEffect, useState } from "react"
import { getUsageStats } from "@/app/dashboard/actions"

interface UsageStats {
  analyzeDeal: number
  generateProtectionPackage: number
}

export function UsageDisplay() {
  const [stats, setStats] = useState<UsageStats | null>(null)

  useEffect(() => {
    getUsageStats().then(setStats)
  }, [])

  if (!stats) return null

  return (
    <div className="text-xs text-muted-foreground px-3 py-1 border-t border-border/60">
      <span className="mr-3">Analyzes: {stats.analyzeDeal}/5</span>
      <span>Generations: {stats.generateProtectionPackage}/10</span>
    </div>
  )
}
