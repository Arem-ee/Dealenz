"use client"

import type { BriefSourceTier, CounterpartyBrief } from "@/lib/counterparty/types"
import { cn } from "@/lib/utils"

function tierLabel(tier: BriefSourceTier): string {
  if (tier === 1) return "Registry"
  if (tier === 2) return "Authoritative DB"
  return "You stated"
}

export function BriefCard({ brief, creditsCharged }: { brief: CounterpartyBrief; creditsCharged?: number | null }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{brief.subject.name}</h3>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
            brief.liveVerified
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
              : "border-amber-500/30 bg-amber-500/5 text-amber-700"
          )}
        >
          {brief.liveVerified ? "Registry-verified" : "Unverified — details only"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {brief.subject.country}
        {typeof creditsCharged === "number" ? ` · ${creditsCharged} credits` : ""}
        {" · "}retrieved {brief.retrievedAt.slice(0, 10)}
      </p>

      <div className="mt-4 space-y-3">
        {brief.claims.map((claim, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-sm leading-relaxed">{claim.statement}</p>
            {claim.quote && (
              <blockquote className="mt-1.5 border-l-2 border-border pl-3 text-xs italic leading-relaxed text-muted-foreground">
                “{claim.quote}”
              </blockquote>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium">{tierLabel(claim.tier)}</span>
              {claim.sourceUrl ? (
                <>
                  {" · "}
                  <a
                    href={claim.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {claim.sourceUrl.replace(/^https?:\/\//, "").slice(0, 48)}
                  </a>
                </>
              ) : null}
            </p>
          </div>
        ))}
      </div>

      {brief.unknowns.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed px-4 py-3">
          <p className="text-xs font-semibold">Not established</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-muted-foreground">
            {brief.unknowns.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
