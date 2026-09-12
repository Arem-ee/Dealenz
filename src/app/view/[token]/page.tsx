import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { PortalView } from "@/components/portal-view"
import { getTrustedClientIp, checkAnonymousRateLimit } from "@/lib/rate-limit-anon"

// Token-guessing throttle: UUIDs are unguessable, but unbounded probing is
// still abuse. Per-IP budget shared across instances; denial renders the
// same not-found as an invalid token (no oracle).
const SHARE_VIEW_LIMIT = 60
const SHARE_VIEW_WINDOW_SECONDS = 3600

interface SharedDocument {
  content: string
  audit_id: string
  document_type: string
  business_name: string
  signed: boolean
  signed_by_name: string
  signed_by_email: string
  signed_at: string | null
}

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function ViewPage({ params }: PageProps) {
  const { token } = await params
  const supabase = await createClient()

  const ip = getTrustedClientIp(await headers())
  const quota = await checkAnonymousRateLimit(supabase, `shareview:${ip}`, SHARE_VIEW_LIMIT, SHARE_VIEW_WINDOW_SECONDS)
  if (!quota.allowed) {
    notFound()
  }

  const { data, error } = await supabase.rpc("get_shared_document", { p_token: token })

  if (error || !data || data.length === 0) {
    notFound()
  }

  const doc = data[0] as SharedDocument

  return (
    <PortalView
      document={doc}
      token={token}
    />
  )
}
