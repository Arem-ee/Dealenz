"use server"

import { createClient } from "@/lib/supabase/server"

export async function createConsultationRequest(auditId: string, note: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be signed in to request a consultation")
  }

  const { data: audit, error: auditError } = await supabase
    .from("audits")
    .select("id, user_id")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .single()

  if (auditError || !audit) {
    throw new Error("Audit not found")
  }

  // Check if there's already a pending/active request for this audit
  const { data: existing } = await supabase
    .from("consultation_requests")
    .select("id")
    .eq("audit_id", auditId)
    .eq("user_id", user.id)
    .in("status", ["requested", "matched", "in_progress"])
    .maybeSingle()

  if (existing) {
    throw new Error("You already have an active consultation request for this audit")
  }

  // Check if there are any verified lawyers
  const { count: verifiedLawyersCount } = await supabase
    .from("lawyers")
    .select("*", { count: "exact", head: true })
    .eq("verification_status", "verified")

  const status = (verifiedLawyersCount ?? 0) > 0 ? "requested" : "waitlist"

  const { error } = await supabase
    .from("consultation_requests")
    .insert({
      audit_id: auditId,
      user_id: user.id,
      status,
      request_note: note,
    })

  if (error) {
    throw new Error(`Failed to create consultation request: ${error.message}`)
  }

  return { success: true, status }
}

export async function getVerifiedLawyersCount() {
  const supabase = await createClient()
  const { count } = await supabase
    .from("lawyers")
    .select("*", { count: "exact", head: true })
    .eq("verification_status", "verified")
  return count ?? 0
}

export async function getConsultationRequest(auditId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { data, error } = await supabase
    .from("consultation_requests")
    .select("*")
    .eq("audit_id", auditId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, request: data }
}