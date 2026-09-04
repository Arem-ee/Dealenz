import Image from "next/image"
import Link from "next/link"
import { SectionWrapper } from "@/components/landing/primitives"

export function FooterSection() {
  return (
    <SectionWrapper as="footer" noBorder borderTop className="py-10 sm:py-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/favicon.svg"
            alt=""
            width={16}
            height={16}
            className="shrink-0 opacity-60"
          />
          <span className="text-xs text-muted-foreground">Know the risk before you sign, (c) 2026 Dealenz</span>
        </div>
        <nav className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/login" className="hover:text-foreground transition-colors">
            Sign in
          </Link>
        </nav>
      </div>
    </SectionWrapper>
  )
}
