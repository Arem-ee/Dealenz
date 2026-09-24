"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, SearchCheck } from "lucide-react"
import {
  counterpartyDefaultsAction,
  researchCounterpartyAction,
  resolveCounterpartyAction,
} from "@/app/counterparty/actions"
import { COUNTERPARTY_COUNTRIES, type CounterpartyCountry, type ResolutionCandidate } from "@/lib/counterparty/types"
import { priceForOperation } from "@/lib/credits/pricing"
import { BriefCard } from "@/components/counterparty/BriefCard"
import type { CounterpartyBrief } from "@/lib/counterparty/types"

type Step = "form" | "confirm" | "done";

export default function CounterpartyNewPage() {
  const router = useRouter()
  const [auditId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get("auditId");
    } catch {
      return null;
    }
  })
  const [name, setName] = useState("")
  const [country, setCountry] = useState<CounterpartyCountry | "">("")
  const [domain, setDomain] = useState("")
  const [regNumber, setRegNumber] = useState("")
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<Step>("form")
  const [candidates, setCandidates] = useState<ResolutionCandidate[]>([])
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [brief, setBrief] = useState<CounterpartyBrief | null>(null)
  const [charged, setCharged] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Deal-attached entry: default the jurisdiction from the deal's context so
  // the user names the party, not the country they already confirmed.
  useState(() => {
    if (!auditId) return
    void counterpartyDefaultsAction(auditId).then((res) => {
      if (res.ok && res.country) setCountry(res.country)
    })
  })

  const picked = candidates.find((c) => c.id === pickedId) ?? null

  async function handleResolve() {
    if (!name.trim() || !country || busy) return
    setBusy(true)
    setError(null)
    const res = await resolveCounterpartyAction({
      name: name.trim(),
      country,
      domain: domain.trim() || null,
      regNumber: regNumber.trim() || null,
      idempotencyKey: crypto.randomUUID(),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setCandidates(res.candidates)
    setPickedId(res.candidates[0]?.id ?? null)
    setStep("confirm")
  }

  async function handleResearch() {
    if (!picked || busy) return
    setBusy(true)
    setError(null)
    const res = await researchCounterpartyAction({
      name: name.trim(),
      country: country as CounterpartyCountry,
      domain: domain.trim() || null,
      regNumber: regNumber.trim() || null,
      url: picked.url,
      sourceName: picked.source,
      auditId,
      idempotencyKey: crypto.randomUUID(),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setBrief(res.brief)
    setCharged(priceForOperation("counterparty_research"))
    setStep("done")
  }

  function handleBack() {
    if (busy) return
    setStep("form")
    setCandidates([])
    setPickedId(null)
    setBrief(null)
    setError(null)
  }

  return (
    <div className="flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <SearchCheck className="h-5 w-5" />
            Research a counterparty
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Name the other party. Dealenz confirms exactly which entity you mean, then reports what public
            registries state — every claim sourced, everything else an explicit unknown.
          </p>
        </div>

        {step === "form" && (
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-name">Company or business name</Label>
              <Input
                id="cp-name"
                placeholder="e.g. Acme Ventures Ltd"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted/50"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-country">Country of registration</Label>
              <select
                id="cp-country"
                value={country}
                onChange={(e) => setCountry(e.target.value as CounterpartyCountry | "")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Select a country</option>
                {COUNTERPARTY_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cp-domain">Website <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="cp-domain" placeholder="acme.com" value={domain} onChange={(e) => setDomain(e.target.value)} className="bg-muted/50" autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cp-reg">Registration no. <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="cp-reg" placeholder="RC123456 / 12345678" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} className="bg-muted/50" autoComplete="off" />
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              Finding candidates costs 1 credit. The registry brief costs {priceForOperation("counterparty_research")} credits and runs only after you
              confirm the exact entity — and only bills when registries return something usable.
            </div>
          </div>
        )}

        {step !== "form" && candidates.length > 0 && (
          <div className="space-y-2" role="radiogroup" aria-label="Confirm the counterparty">
            <p className="text-xs text-muted-foreground">Which entity is your counterparty? Research runs only on the one you pick.</p>
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={pickedId === c.id}
                disabled={busy || step === "done"}
                onClick={() => setPickedId(c.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors disabled:opacity-70 ${pickedId === c.id ? "border-burgundy bg-burgundy/[0.06]" : "border-input bg-background hover:bg-muted/50"}`}
              >
                <span aria-hidden className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${pickedId === c.id ? "border-burgundy" : "border-muted-foreground/40"}`}>
                  {pickedId === c.id && <span className="h-2 w-2 rounded-full bg-burgundy" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {c.detailsOnly ? "Your details only — registries cannot be checked on this path" : c.source ? `Via ${c.source}` : "Via registry search"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {step === "done" && brief && <BriefCard brief={brief} creditsCharged={charged} />}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between">
          {step === "form" ? (
            <Button variant="ghost" disabled={busy} onClick={() => router.push("/dashboard")}>Cancel</Button>
          ) : (
            <Button variant="ghost" disabled={busy} onClick={handleBack}>Start over</Button>
          )}
          {step === "form" && (
            <Button onClick={handleResolve} disabled={!name.trim() || !country || busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Looking up…" : "Find candidates · 1 credit"}
            </Button>
          )}
          {step === "confirm" && (
            <Button onClick={handleResearch} disabled={!picked || busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Researching…" : `Run registry brief · ${priceForOperation("counterparty_research")} credits`}
            </Button>
          )}
          {step === "done" && (
            <Link href="/dashboard" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Back to deals
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
