import Link from "next/link"
import { Logo } from "@/components/logo"
import { AuthForm } from "@/components/auth-form"

export const dynamic = "force-dynamic"

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo className="mb-2" />
          <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
          <p className="text-sm text-muted-foreground">
            Start auditing your deals with AI
          </p>
        </div>

        <AuthForm mode="register" />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
