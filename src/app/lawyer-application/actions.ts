"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export interface LawyerApplicationData {
  full_name: string
  bio: string
  bar_license_number: string
  bar_jurisdiction: string
  specialties: string[]
  years_experience: number
  notable_cases: string
  certifications: string[]
}

export async function submitLawyerApplication(data: LawyerApplicationData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be signed in to apply")
  }

  const { data: existing, error: checkError } = await supabase
    .from("lawyers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (checkError) {
    throw new Error(`Failed to check existing application: ${checkError.message}`)
  }

  if (existing) {
    throw new Error("You have already submitted an application")
  }

  const { error } = await supabase
    .from("lawyers")
    .insert({
      user_id: user.id,
      full_name: data.full_name,
      bio: data.bio,
      bar_license_number: data.bar_license_number,
      bar_jurisdiction: data.bar_jurisdiction,
      specialties: data.specialties,
      years_experience: data.years_experience,
      notable_cases: data.notable_cases,
      certifications: data.certifications,
      verification_status: "pending",
    })

  if (error) {
    throw new Error(`Failed to submit application: ${error.message}`)
  }

  return { success: true }
}

export async function getLawyerApplicationStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { data, error } = await supabase
    .from("lawyers")
    .select("verification_status, created_at, verified_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  if (!data) {
    return { success: true, status: "not_applied" }
  }

  return { success: true, status: data.verification_status, created_at: data.created_at, verified_at: data.verified_at }
}