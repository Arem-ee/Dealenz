import Link from "next/link"
import { Logo } from "@/components/logo"

export default function SignNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <Link href="/" aria-label="Dealenz home">
        <Logo />
      </Link>
      <div>
        <h1 className="text-lg font-semibold">This signing link is no longer valid.</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          It expired, was revoked, superseded by a newer version — or never existed. Ask the sender for a fresh link.
        </p>
      </div>
    </div>
  )
}
