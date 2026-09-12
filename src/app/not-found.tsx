import Link from "next/link"
import { Logo } from "@/components/logo"

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Link href="/">
        <Logo />
      </Link>
      <div>
        <h1 className="text-lg font-semibold">This page could not be found.</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          The link you followed does not exist or was moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go to your home
        </Link>
      </div>
    </div>
  )
}
