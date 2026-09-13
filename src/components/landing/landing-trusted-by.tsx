import { Briefcase, Store, HardHat, MessagesSquare, House, PenLine, Rocket } from "lucide-react"

export function LandingTrustedBy() {
  const items = [
    { label: "Freelancers", icon: Briefcase },
    { label: "Business owners", icon: Store },
    { label: "Contractors", icon: HardHat },
    { label: "Consultants", icon: MessagesSquare },
    { label: "Landlords", icon: House },
    { label: "Anyone signing something", icon: PenLine },
    { label: "Founders", icon: Rocket },
  ]
  const loop = [...items, ...items, ...items]
  return (
    <div className="border-y border-white/20 py-4 px-6 sm:px-10">
      <div className="relative overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {loop.map((item, i) => {
            const Icon = item.icon
            return (
              <span key={i} className="flex items-center" aria-hidden={i >= items.length ? true : undefined}>
                <span className="flex items-center gap-2 px-6 text-sm font-medium tracking-tight text-[#141110]">
                  <Icon className="h-3.5 w-3.5 text-[var(--primary)]/60" />
                  {item.label}
                </span>
                <span className="h-1 w-1 rounded-full bg-[var(--primary)]/60" />
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
