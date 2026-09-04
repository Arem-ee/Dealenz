export function LandingTrustedBy() {
  const items = ["Freelancers", "Business owners", "Contractors", "Consultants", "Landlords", "Anyone signing something", "Founders"]
  const loop = [...items, ...items, ...items]
  return (
    <div className="border-y border-white/20 py-4 px-6 sm:px-10">
      <div className="relative overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {loop.map((item, i) => (
            <span key={i} className="flex items-center">
              <span className="px-6 text-sm font-medium tracking-tight text-[#141110]">{item}</span>
              <span className="h-1 w-1 rounded-full bg-[var(--primary)]/60" />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}