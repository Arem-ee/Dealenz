"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import { createAudit } from "./actions"
import { DealTypeSelector, type DealType } from "@/components/audit/deal-type-selector"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

function NewAuditContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const template = searchParams.get("template") || undefined
  const initialType = searchParams.get("deal_type") as DealType | null
  const [dealType, setDealType] = useState<DealType | null>(initialType ?? null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    if (!dealType) return
    setCreating(true)
    setError(null)
    try {
      await createAudit(template, dealType)
    } catch (err) {
      if (isRedirectError(err)) return
      setError(err instanceof Error ? err.message : "Failed to create audit")
      setCreating(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-xl space-y-6">
        <DealTypeSelector value={dealType} onChange={setDealType} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>Cancel</Button>
          <Button onClick={handleContinue} disabled={!dealType || creating}>
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function NewAuditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        </div>
      }
    >
      <NewAuditContent />
    </Suspense>
  )
}
