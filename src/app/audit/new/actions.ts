"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

const ALLOWED_DEAL_TYPES = new Set(["freelance", "generic"] as const)

export type DealType = "freelance" | "generic"

function normalizeDealType(input?: string | null): DealType {
  if (input && ALLOWED_DEAL_TYPES.has(input as DealType)) return input as DealType
  return "freelance"
}

export async function createAudit(template?: string, dealTypeInput?: string) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("Unauthorized – please sign in")
  }

  const dealType = normalizeDealType(dealTypeInput)

  const payload: Record<string, unknown> = {
    user_id: user.id,
    title: "New Deal",
    status: "draft",
    deal_type: dealType,
  }

  if (template) {
    payload.source_type = template
  }

  let data: { id: string } | null = null
  let error: { message: string } | null = null
  const result = await supabase.from("audits").insert(payload).select("id").single()
  data = result.data as { id: string } | null
  error = result.error as { message: string } | null

  if (error && error.message.includes("deal_type")) {
    const fallbackPayload: Record<string, unknown> = {
      user_id: user.id,
      title: "New Deal",
      status: "draft",
    }
    if (template) fallbackPayload.source_type = template
    const retry = await supabase.from("audits").insert(fallbackPayload).select("id").single()
    data = retry.data as { id: string } | null
    error = retry.error as { message: string } | null
  }

  if (error || !data) {
    throw new Error(`Failed to create audit: ${error?.message ?? "unknown error"}`)
  }

  redirect(`/audit/${data.id}`)
}
