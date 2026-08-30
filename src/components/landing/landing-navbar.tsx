import Link from "next/link"
import { Logo } from "@/components/logo"
import { LandingContainer } from "./landing-container"
import { LandingButton } from "./landing-button"

export function LandingNavbar() {
  return (
    <nav className="sticky top-0 z-50 bg-surface/70 backdrop-blur-[20px] saturate-[1.5] border-b border-border-subtle">
      <LandingContainer width="wide">
        <div className="flex h-14 items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-text-secondary hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <LandingButton variant="primary" href="/register">
              Analyze your first deal
            </LandingButton>
          </div>
        </div>
      </LandingContainer>
    </nav>
  )
}
