"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ApplicationStatus {
  success: boolean
  status?: "pending" | "verified" | "rejected" | "not_applied"
  verification_status?: "pending" | "verified" | "rejected"
  created_at?: string
  verified_at?: string
  error?: string
}

export default function LawyerApplicationStatusPage() {
  const [status, setStatus] = useState<ApplicationStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/lawyer-application/status")
        const data = await res.json()
        setStatus(data)
      } catch {
        setStatus({ success: false, error: "Failed to fetch status" })
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!status?.success) {
    return (
      <div className="min-h-screen bg-[#F2F0ED] px-4 py-10">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="text-2xl font-semibold">Unable to Load Status</h1>
          <p className="mt-2 text-sm text-muted-foreground">{status?.error ?? "Unknown error"}</p>
          <Link href="/dashboard" className="mt-4 inline-block">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  const { status: appStatus } = status

  const statusConfig = {
    pending: {
      icon: Clock,
      color: "text-amber-600 bg-amber-50",
      title: "Application Under Review",
      description: "Your application has been received and is being reviewed by our team. This typically takes 3-5 business days.",
    },
    verified: {
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50",
      title: "Application Approved",
      description: "You are now a verified Dealenz lawyer. You can start receiving consultation requests.",
    },
    rejected: {
      icon: XCircle,
      color: "text-destructive bg-destructive/10",
      title: "Application Not Approved",
      description: "Your application was not approved at this time. You may reapply in the future.",
    },
    not_applied: {
      icon: AlertCircle,
      color: "text-muted-foreground bg-muted",
      title: "No Application Found",
      description: "You haven't submitted a lawyer application yet.",
    },
  }

  const config = appStatus ? statusConfig[appStatus] : statusConfig.not_applied
  const Icon = config?.icon ?? AlertCircle

  return (
    <div className="min-h-screen bg-[#F2F0ED] px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          Back to Home
        </Link>

        <div className="bg-white rounded-2xl border border-black/10 shadow-sm p-6 sm:p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className={cn("flex h-16 w-16 items-center justify-center rounded-full", config.color)}>
              <Icon className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{config.description}</p>

          {status.created_at && (
            <div className="mt-6 p-4 rounded-xl bg-muted/50 text-left">
              <p className="text-sm font-medium">Application submitted</p>
              <p className="text-sm text-muted-foreground">{new Date(status.created_at).toLocaleDateString()}</p>
            </div>
          )}

          {status.verified_at && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-50 text-left">
              <p className="text-sm font-medium text-emerald-700">Verified on</p>
              <p className="text-sm text-emerald-600">{new Date(status.verified_at).toLocaleDateString()}</p>
            </div>
          )}

          <div className="mt-8 space-y-3">
            {status.verification_status === "verified" ? (
              <Link href="/dashboard">
                <Button className="w-full">Go to Dashboard</Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">Back to Dashboard</Button>
              </Link>
            )}
            <Link href="/lawyer-application" className="text-sm text-primary underline-offset-2 hover:no-underline">
              Submit a new application
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}