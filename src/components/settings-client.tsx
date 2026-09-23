"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { upsertBusinessProfile } from "@/app/audit/[id]/actions"
import { getGoogleLinkPath } from "@/app/dashboard/settings/actions"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Loader2, Check, AlertCircle, Sun, Moon, Monitor, Download } from "lucide-react"
import { useTheme, type ThemeChoice } from "@/components/theme-provider"
import { exportMyData } from "@/app/settings/actions"
import { SharedLinksCard } from "@/components/settings/shared-links"

type Section = "account" | "appearance" | "privacy" | "billing" | "security"

const sections: { key: Section; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "appearance", label: "Appearance" },
  { key: "privacy", label: "Privacy" },
  { key: "billing", label: "Billing" },
  { key: "security", label: "Security" },
]

interface SettingsClientProps {
  initialProfile: Record<string, unknown> | null
  email: string
  googleConnected: boolean
  gmailConnected: boolean
}

export default function SettingsClient({ initialProfile, email, googleConnected, gmailConnected }: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState<Section>("account")
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")

  const [businessName, setBusinessName] = useState((initialProfile?.business_name as string) ?? "")
  const [legalEntity, setLegalEntity] = useState((initialProfile?.legal_entity as string) ?? "")
  const [address, setAddress] = useState((initialProfile?.address as string) ?? "")
  const [city, setCity] = useState((initialProfile?.city as string) ?? "")
  const [country, setCountry] = useState((initialProfile?.country as string) ?? "")
  const [businessEmail, setBusinessEmail] = useState((initialProfile?.email as string) ?? "")
  const [phone, setPhone] = useState((initialProfile?.phone as string) ?? "")
  const [website, setWebsite] = useState((initialProfile?.website as string) ?? "")
  const [currency, setCurrency] = useState((initialProfile?.default_currency as string) ?? "USD")
  const [paymentTerms, setPaymentTerms] = useState((initialProfile?.default_payment_terms as string) ?? "")
  const [standardRate, setStandardRate] = useState((initialProfile?.standard_rate as string) ?? "")
  const [rateUnit, setRateUnit] = useState((initialProfile?.rate_unit as string) ?? "hour")

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveState("saving")
    try {
      await upsertBusinessProfile({
        business_name: businessName,
        legal_entity: legalEntity,
        address,
        city,
        country,
        email: businessEmail,
        phone,
        website,
        default_currency: currency,
        default_payment_terms: paymentTerms,
        standard_rate: standardRate ? parseFloat(standardRate) : null,
        rate_unit: rateUnit,
      })
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2000)
    } catch {
      setSaveState("error")
    } finally {
      setSaving(false)
    }
  }, [businessName, legalEntity, address, city, country, businessEmail, phone, website, currency, paymentTerms, standardRate, rateUnit])

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your account, billing, security, and team
        </p>
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[200px_1fr] lg:gap-10">
        <nav className="flex lg:flex-col gap-1 pb-4 lg:pb-0 border-b lg:border-b-0 overflow-x-auto">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              aria-current={activeSection === s.key ? "page" : undefined}
              className={cn(
                "shrink-0 text-sm px-3 py-2 rounded-md text-left transition-colors",
                activeSection === s.key
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="mt-6 lg:mt-0">
          {activeSection === "account" && (
            <BusinessProfileSection
              businessName={businessName} onBusinessNameChange={setBusinessName}
              legalEntity={legalEntity} onLegalEntityChange={setLegalEntity}
              address={address} onAddressChange={setAddress}
              city={city} onCityChange={setCity}
              country={country} onCountryChange={setCountry}
              businessEmail={businessEmail} onBusinessEmailChange={setBusinessEmail}
              phone={phone} onPhoneChange={setPhone}
              website={website} onWebsiteChange={setWebsite}
              currency={currency} onCurrencyChange={setCurrency}
              paymentTerms={paymentTerms} onPaymentTermsChange={setPaymentTerms}
              standardRate={standardRate} onStandardRateChange={setStandardRate}
              rateUnit={rateUnit} onRateUnitChange={setRateUnit}
              onSave={handleSave}
              saving={saving}
              saveState={saveState}
            />
          )}
          {activeSection === "account" && <DeleteAccountSection />}
          {activeSection === "appearance" && <AppearanceSection />}
          {activeSection === "privacy" && <PrivacySection />}
          {activeSection === "billing" && <BillingSection />}
          {activeSection === "security" && <SecuritySection email={email} googleConnected={googleConnected} gmailConnected={gmailConnected} />}
        </div>
      </div>
    </div>
  )
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

const THEME_OPTIONS: { key: ThemeChoice; label: string; hint: string; Icon: typeof Sun }[] = [
  { key: "light", label: "Light", hint: "Always light", Icon: Sun },
  { key: "dark", label: "Dark", hint: "Always dark", Icon: Moon },
  { key: "system", label: "System", hint: "Follows your device", Icon: Monitor },
]

function PrivacySection() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      const res = await exportMyData()
      if (!res.ok) {
        setError(res.error)
        return
      }
      const blob = new Blob([JSON.stringify(res.export, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dealenz-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError("We couldn't assemble your export. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Your data"
        description="Deals, threads, documents, monitoring, billing history, and profile — one JSON file"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => void download()} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
            {busy ? "Assembling…" : "Download my data"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          To remove a single deal instead of everything, delete it from your deals table on the
          dashboard. To erase your entire account, use Delete account under the Account tab.
        </p>
      </SectionCard>
      <SectionCard
        title="Shared links"
        description="Everything you published a link for — revoke any of them here"
      >
        <SharedLinksCard />
      </SectionCard>
    </div>
  )
}

function AppearanceSection() {
  const { choice, setChoice } = useTheme()
  return (
    <div className="space-y-4">
      <SectionCard title="Appearance" description="Light or dark, across the whole app">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Color theme">
          {THEME_OPTIONS.map(({ key, label, hint, Icon }) => {
            const active = choice === key
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChoice(key)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs transition-colors",
                  active
                    ? "border-burgundy bg-burgundy/10 font-semibold text-burgundy"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                <span className="text-[10px] font-normal opacity-70">{hint}</span>
              </button>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

interface BusinessFieldsProps {
  businessName: string; onBusinessNameChange: (v: string) => void
  legalEntity: string; onLegalEntityChange: (v: string) => void
  address: string; onAddressChange: (v: string) => void
  city: string; onCityChange: (v: string) => void
  country: string; onCountryChange: (v: string) => void
  businessEmail: string; onBusinessEmailChange: (v: string) => void
  phone: string; onPhoneChange: (v: string) => void
  website: string; onWebsiteChange: (v: string) => void
  currency: string; onCurrencyChange: (v: string) => void
  paymentTerms: string; onPaymentTermsChange: (v: string) => void
  standardRate: string; onStandardRateChange: (v: string) => void
  rateUnit: string; onRateUnitChange: (v: string) => void
  onSave: () => void
  saving: boolean
  saveState: "idle" | "saving" | "saved" | "error"
}

function BusinessProfileSection({
  businessName, onBusinessNameChange,
  legalEntity, onLegalEntityChange,
  address, onAddressChange,
  city, onCityChange,
  country, onCountryChange,
  businessEmail, onBusinessEmailChange,
  phone, onPhoneChange,
  website, onWebsiteChange,
  currency, onCurrencyChange,
  paymentTerms, onPaymentTermsChange,
  standardRate, onStandardRateChange,
  rateUnit, onRateUnitChange,
  onSave, saving, saveState,
}: BusinessFieldsProps) {
  return (
    <div className="space-y-4">
      <SectionCard title="Business Information" description="Populates your documents and proposals">
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-business-name">Legal Business Name</Label>
            <Input id="settings-business-name" placeholder="Your Name or LLC" className="bg-muted/50" value={businessName} onChange={(e) => onBusinessNameChange(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-entity-type">Entity Type</Label>
            <Input id="settings-entity-type" placeholder="Sole Proprietor / LLC / Corporation" className="bg-muted/50" value={legalEntity} onChange={(e) => onLegalEntityChange(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-address">Business Address</Label>
            <Input id="settings-address" placeholder="Street, City, State, ZIP" className="bg-muted/50" value={address} onChange={(e) => onAddressChange(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-city">City</Label>
            <Input id="settings-city" placeholder="City" className="bg-muted/50" value={city} onChange={(e) => onCityChange(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-country">Country</Label>
            <Input id="settings-country" placeholder="Country" className="bg-muted/50" value={country} onChange={(e) => onCountryChange(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-business-email">Business Email</Label>
            <Input id="settings-business-email" type="email" placeholder="business@example.com" className="bg-muted/50" value={businessEmail} onChange={(e) => onBusinessEmailChange(e.target.value)} autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-phone">Phone</Label>
            <Input id="settings-phone" placeholder="+1 (555) 123-4567" className="bg-muted/50" value={phone} onChange={(e) => onPhoneChange(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-website">Website</Label>
            <Input id="settings-website" placeholder="https://example.com" className="bg-muted/50" value={website} onChange={(e) => onWebsiteChange(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-rate">Default Rate</Label>
              <Input id="settings-rate" placeholder="$150/hr" className="bg-muted/50" value={standardRate} onChange={(e) => onStandardRateChange(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-rate-unit">Rate Unit</Label>
              <select
                id="settings-rate-unit"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={rateUnit}
                onChange={(e) => onRateUnitChange(e.target.value)}
              >
                <option value="hour">Per hour</option>
                <option value="day">Per day</option>
                <option value="project">Per project</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-currency">Currency</Label>
              <Input id="settings-currency" value={currency} onChange={(e) => onCurrencyChange(e.target.value)} className="bg-muted/50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-terms">Default Payment Terms</Label>
              <Input id="settings-terms" placeholder="Net 15" className="bg-muted/50" value={paymentTerms} onChange={(e) => onPaymentTermsChange(e.target.value)} />
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saveState === "saved" && <Check className="h-4 w-4" />}
          {saveState === "error" && <AlertCircle className="h-4 w-4" />}
          {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Error — try again" : "Save Business Profile"}
        </Button>
      </div>
    </div>
  )
}

function BillingSection() {
  return (
    <SectionCard title="Billing" description="Credits, purchases, and usage live on the Billing page">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Credits & purchases</p>
          <p className="text-xs text-muted-foreground">Deal analyses, Ask credit packs, and purchase history.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/billing">Open billing</Link>
        </Button>
      </div>
    </SectionCard>
  )
}

function GoogleConnectButton({ connected }: { connected: boolean }) {
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  if (connected) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Check className="mr-1.5 h-3.5 w-3.5" />
        Connected
      </Button>
    )
  }

  const handleConnect = async () => {
    setLinking(true)
    setLinkError(null)
    try {
      // Server verifies the session first; the returned path is fixed and
      // server-owned, never attacker-controlled.
      const authz = await getGoogleLinkPath()
      if (!authz.success || !authz.path) {
        throw new Error("link_not_authorized")
      }
      const supabase = createClient()
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${authz.path}` },
      })
      if (error) throw error
      // On success the browser leaves for Google; the callback completes linking.
    } catch {
      setLinkError("We couldn't connect this Google account. Please try again.")
      setLinking(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="outline" size="sm" onClick={handleConnect} disabled={linking}>
        {linking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        Connect Google
      </Button>
      {linkError ? (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {linkError}
        </p>
      ) : null}
    </div>
  )
}

function SecuritySection({ email, googleConnected, gmailConnected }: { email: string; googleConnected: boolean; gmailConnected: boolean }) {
  const [newPassword, setNewPassword] = useState("")
  const [pwBusy, setPwBusy] = useState(false)
  const [pwState, setPwState] = useState<"idle" | "saved" | "error">("idle")
  const [pwError, setPwError] = useState<string | null>(null)

  async function handlePasswordChange() {
    if (newPassword.length < 8 || pwBusy) return
    setPwBusy(true)
    setPwState("idle")
    setPwError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword("")
      setPwState("saved")
      setTimeout(() => setPwState("idle"), 3000)
    } catch (e) {
      setPwState("error")
      setPwError(e instanceof Error ? e.message : "We couldn't change your password. Please try again.")
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Account Security" description="Password, sessions, and account recovery">
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-email">Email</Label>
            <Input id="settings-email" value={email} readOnly className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Used for sign-in and notifications</p>
          </div>
          <div className="rounded-lg border p-3">
            <Label htmlFor="settings-password">Password</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="settings-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password, at least 8 characters"
                disabled={pwBusy}
                autoComplete="new-password"
              />
              <Button variant="outline" size="sm" className="shrink-0" disabled={pwBusy || newPassword.length < 8} onClick={() => void handlePasswordChange()}>
                {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change"}
              </Button>
            </div>
            {pwState === "saved" && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3 w-3" /> Password changed.
              </p>
            )}
            {pwState === "error" && (
              <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" /> {pwError}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Google</p>
              <p className="text-xs text-muted-foreground">
                {googleConnected
                  ? "Your Google account is connected to this Dealenz account"
                  : "Sign in with Google on this account"}
              </p>
            </div>
            <GoogleConnectButton connected={googleConnected} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Gmail</p>
              <p className="text-xs text-muted-foreground">
                {gmailConnected
                  ? "Connected — Dealenz can email monitoring alerts and import deal threads"
                  : "Connect once to email monitoring alerts and import deal threads from your inbox"}
              </p>
            </div>
            <a
              href="/api/gmail/auth"
              className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
            >
              {gmailConnected ? "Reconnect" : "Connect Gmail"}
            </a>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function DeleteAccountSection() {
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (typed.trim() !== "DELETE" || busy) return
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("You are no longer signed in. Please reload and sign in again.")
      // Files live outside the SQL cascade graph and cannot be removed in SQL
      // (the platform rejects direct storage deletes), so remove them through
      // the Storage API first, recursively under the caller's own prefix.
      async function removePrefix(prefix: string): Promise<void> {
        const { data: entries, error: listError } = await supabase.storage.from("audit-files").list(prefix)
        if (listError) throw new Error(listError.message)
        for (const entry of entries ?? []) {
          const path = prefix ? `${prefix}/${entry.name}` : entry.name
          if (entry.metadata == null) {
            await removePrefix(path)
          } else {
            const { error: removeError } = await supabase.storage.from("audit-files").remove([path])
            if (removeError) throw new Error(removeError.message)
          }
        }
      }
      await removePrefix(user.id)
      const { error: rpcError } = await supabase.rpc("delete_own_account")
      if (rpcError) throw new Error(rpcError.message)
      await supabase.auth.signOut()
      window.location.href = "/"
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't delete your account. Please try again.")
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-destructive/30 p-5">
      <p className="text-sm font-semibold text-destructive">Delete account</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Permanently deletes your account and everything in it — deals, documents,
        threads, monitoring, credits, and files. This cannot be undone.
      </p>
      {!confirming ? (
        <Button variant="outline" size="sm" className="mt-3 text-destructive" onClick={() => setConfirming(true)}>
          Delete my account…
        </Button>
      ) : (
        <div className="mt-3 space-y-3">
          <Label htmlFor="delete-confirm">
            Type <span className="font-mono font-semibold">DELETE</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            disabled={busy}
            autoComplete="off"
          />
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={busy || typed.trim() !== "DELETE"}
              onClick={() => void handleDelete()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Permanently delete everything"}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setConfirming(false); setTyped(""); setError(null) }}>
              Keep my account
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
