"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { upsertBusinessProfile } from "@/app/audit/[id]/actions"

// First-run setup: the two fields that pay off everywhere (name on
// documents, country answering jurisdiction up front), everything else
// optional and skippable. Value-first: the payoff is stated before a single
// keystroke, and Skip never blocks the product.
export default function WelcomePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [country, setCountry] = useState("")
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function dismiss() {
    try {
      window.localStorage.setItem("dealenz.welcome.dismissed", "1")
    } catch {
      // Private mode: the banner may return; the product still works.
    }
    router.push("/dashboard")
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await upsertBusinessProfile({
        ...(name.trim() ? { business_name: name.trim() } : {}),
        ...(country.trim() ? { country: country.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      })
      if (!res.ok) {
        setError(res.error)
        setSaving(false)
        return
      }
      dismiss()
    } catch {
      setError("We couldn't save that. Please try again.")
      setSaving(false)
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6 my-auto">
        <div>
          <h1 className="text-lg font-semibold">Two minutes that pays off in every deal</h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Your name goes on every generated document. Your country answers jurisdiction questions up front,
            so analyses ask less. Everything else can wait for Settings.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="welcome-name">Your name or business name</Label>
            <Input
              id="welcome-name"
              placeholder="e.g. Adaeze Okafor / Okafor Studios LLC"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-muted/50"
              autoComplete="organization"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="welcome-country">Country</Label>
            <Input
              id="welcome-country"
              placeholder="e.g. Nigeria"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-muted/50"
              autoComplete="country-name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="welcome-email">
              Business email <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="welcome-email"
              type="email"
              placeholder="business@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-muted/50"
              autoComplete="email"
            />
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between">
          <Button variant="ghost" disabled={saving} onClick={dismiss}>Skip for now</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Save and continue"}
          </Button>
        </div>
      </div>
    </div>
    </div>
  )
}
