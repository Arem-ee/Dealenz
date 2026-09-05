"use client"

import { useRouter, usePathname } from "next/navigation"
import { Settings, LogOut, History, CreditCard, MessageCircle } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Logo } from "@/components/logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  IconDeal,
  IconPipeline,
  IconClient,
  IconRiskFlag,
  IconTemplate,
} from "@/components/icons"

const navItems = [
  { label: "Home", href: "/dashboard", icon: IconPipeline },
  { label: "Ask", href: "/ask", icon: MessageCircle },
  { label: "Deals", href: "/deals", icon: IconDeal },
  { label: "Clients", href: "/clients", icon: IconClient },
  { label: "Risk Intelligence", href: "/risk-intelligence", icon: IconRiskFlag },
  { label: "Templates", href: "/templates", icon: IconTemplate },
]

interface SidebarNavProps {
  email: string
  businessName?: string | null
}

export function SidebarNav({ email, businessName }: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const displayName = businessName ?? email
  const initials = displayName.charAt(0).toUpperCase()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="hidden md:flex md:flex-col w-56 border-r border-border/60 bg-background shrink-0 glass">
      <div className="flex h-14 items-center px-5 border-b border-border/60">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 p-3 mt-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border/60">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] font-medium">{initials}</AvatarFallback>
              </Avatar>
              <span className="truncate text-xs">{displayName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="start" side="right">
            <DropdownMenuItem asChild>
              <button className="w-full" onClick={() => router.push("/billing")}>
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <button className="w-full" onClick={() => router.push("/dashboard/activity")}>
                <History className="mr-2 h-4 w-4" />
                Activity
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <button className="w-full" onClick={() => router.push("/dashboard/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </button>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <button className="w-full" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
