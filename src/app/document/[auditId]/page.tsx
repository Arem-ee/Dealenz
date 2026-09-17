import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { DocumentReader } from "@/components/document/DocumentReader"

export const dynamic = "force-dynamic"

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ auditId: string }>; searchParams: Promise<{ threadId?: string }> }) {
  const { auditId } = await params
  const { threadId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: audit } = await supabase.from("audits").select("id, user_id, title").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  if (!audit) notFound()

  const { data: versionRows } = await supabase
    .from("document_versions")
    .select("id, document_type, version_number, content, generation_method, created_at")
    .eq("audit_id", auditId)
    .order("version_number", { ascending: false })
    .limit(50)

  const versions = ((versionRows ?? []) as Array<{ id: string; document_type: string; version_number: number; content: string; generation_method: string | null; created_at: string }>).map((v) => ({
    id: String(v.id),
    documentType: String(v.document_type),
    versionNumber: v.version_number ?? 0,
    content: String(v.content ?? ""),
    generationMethod: v.generation_method ?? null,
    createdAt: String(v.created_at ?? new Date().toISOString()),
  }))

  const { data: signerRows } = await supabase
    .from("document_signers")
    .select("id, name, email, party_label, status, signed_at, token")
    .eq("audit_id", auditId)
    .order("created_at", { ascending: true })

  const signers = ((signerRows ?? []) as Array<{ id: string; name: string; email: string; party_label: string; status: string; signed_at: string | null; token: string | null }>).map((s) => ({
    id: String(s.id),
    name: String(s.name),
    email: String(s.email),
    partyLabel: String(s.party_label ?? "signer"),
    status: String(s.status),
    signedAt: s.signed_at ? String(s.signed_at) : null,
    token: s.token ? String(s.token) : null,
  }))

  const { data: finals } = await supabase.from("final_documents").select("document_version_id").eq("audit_id", auditId).limit(10)
  const finalIds = new Set(((finals ?? []) as Array<{ document_version_id: string }>).map((f) => String(f.document_version_id)))
  const isFinal = versions.length > 0 && finalIds.has(versions[0].id)
  const executed = signers.length > 0 && signers.every((s) => s.status === "signed")

  return <DocumentReader auditId={auditId} threadId={threadId ?? null} versions={versions} signers={signers} executed={executed} isFinal={isFinal} />
}
