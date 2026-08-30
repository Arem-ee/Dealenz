import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { PortalView } from "@/components/portal-view"

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
