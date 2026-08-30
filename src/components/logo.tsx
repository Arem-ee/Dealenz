import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  showText?: boolean
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative h-7 w-7 shrink-0">
        <Image
          src="/favicon.svg"
          alt="Dealenz"
          fill
          className="object-contain"
          priority
        />
      </div>
      {showText && (
        <span className="text-base font-semibold tracking-tight">dealenz</span>
      )}
    </div>
  )
}
