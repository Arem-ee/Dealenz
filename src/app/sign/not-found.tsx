import Link from "next/link"
import { Logo } from "@/components/logo"

export default function SignNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Link href="/">
        <Logo />
      </Link>
      <div>
        <h1 className="text-lg font-semibold">This signing link is no longer valid.</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          The signing link you followed has expired, been revoked, or does not exist.
          Contact the person who sent it for a new link.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link href="/" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Go to Dealenz home
          </Link>
        </div>
      </div>
    </div>
  )
}
