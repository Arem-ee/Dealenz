"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { logAuthFailure } from "@/app/login/actions"

interface AuthFormProps {
  mode: "login" | "register"
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        router.push("/dashboard?verify=true")
        router.refresh()
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push("/dashboard")
      }
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred"
      setError(msg)
      logAuthFailure(msg, mode)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          minLength={8}
        />
      </div>

      {mode === "login" && (
        <div className="text-right mt-1">
          <button
            type="button"
            onClick={async () => {
              if (!email) return
              const { error } = await supabase.auth.resetPasswordForEmail(email)
              if (error) {
                setError(error.message)
              } else {
                setError(null)
                alert("Password reset email sent. Check your inbox.")
              }
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Forgot password?
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
    </form>
  )
}
