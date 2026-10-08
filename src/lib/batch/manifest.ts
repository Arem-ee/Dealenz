// Batch manifest — pure preview for the folder-drop motion (D1–D2).
//
// A manifest is computed, never stored: the selected deals' type mix plus
// the credit estimate (N × ANALYSIS_CREDITS, the same price the plan steps
// carry) so approval quotes exactly what execution charges. The work plan
// remains the durable record (D8).

import { ANALYSIS_CREDITS } from "@/lib/credits/pricing"
import { MAX_BATCH_DEALS } from "@/lib/work/schema"

export interface ManifestDeal {
  auditId: string
  title: string
  dealType: string | null
}

export interface BatchManifest {
  count: number
  maxDeals: number
  typeMix: Array<{ dealType: string; count: number }>
  estimateCredits: number
  perFileCredits: number
  overLimit: boolean
}

export function buildBatchManifest(deals: ManifestDeal[]): BatchManifest {
  const count = deals.length
  const mix = new Map<string, number>()
  for (const d of deals) {
    const t = d.dealType?.trim() ? d.dealType : "unknown"
    mix.set(t, (mix.get(t) ?? 0) + 1)
  }
  return {
    count,
    maxDeals: MAX_BATCH_DEALS,
    typeMix: [...mix.entries()]
      .map(([dealType, n]) => ({ dealType, count: n }))
      .sort((a, b) => b.count - a.count || a.dealType.localeCompare(b.dealType)),
    estimateCredits: count * ANALYSIS_CREDITS,
    perFileCredits: ANALYSIS_CREDITS,
    overLimit: count > MAX_BATCH_DEALS || count === 0,
  }
}
