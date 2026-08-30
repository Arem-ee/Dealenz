"use server"

import { createClient } from "@/lib/supabase/server"
import { logEvent } from "@/lib/logger"

export async function logAuthFailure(errorMessage: string, mode: "login" | "register") {
  await logEvent({
    phase: `auth_${mode}`,
    status: "failure",
    error_message: errorMessage,
  })
}

export async function resendVerification() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "No authenticated user" }
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email!,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
