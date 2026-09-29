import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  showText?: boolean
  showSubtitle?: boolean
  dark?: boolean
  size?: "sm" | "md" | "lg"
}

export function Logo({
  className,
  showText = true,
  showSubtitle = false,
  dark = false,
  size = "md",
}: LogoProps) {
  const sizeMap = {
    sm: "h-6 w-6",
    md: "h-7 w-7",
    lg: "h-9 w-9",
  }

  const textSizeMap = {
    sm: "text-[14px]",
    md: "text-[16px]",
    lg: "text-[19px]",
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("relative shrink-0 overflow-hidden rounded-[8px] shadow-sm", sizeMap[size])}>
        <Image
          src="/favicon.svg"
          alt="Dealenz"
          fill
          className="object-cover"
          priority
        />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(
              "font-bold tracking-tight leading-none",
              textSizeMap[size],
              dark ? "text-white" : "text-neutral-950 dark:text-white"
            )}
          >
            dealenz
          </span>
          {showSubtitle && (
            <span
              className={cn(
                "mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.16em]",
                dark ? "text-amber-400" : "text-amber-600 dark:text-amber-400"
              )}
            >
              Deal Intelligence
            </span>
          )}
        </div>
      )}
    </div>
  )
}
