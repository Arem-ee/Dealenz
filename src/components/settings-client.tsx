"use client"

import { useState, useCallback } from "react"
import { upsertBusinessProfile } from "@/app/audit/[id]/actions"
import { getGoogleLinkPath } from "@/app/dashboard/settings/actions"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Loader2, Check, AlertCircle } from "lucide-react"

type Section = "business" | "notifications" | "integrations" | "security" | "team"

const sections: { key: Section; label: string }[] = [
  { key: "business", label: "Business Profile" },
  { key: "notifications", label: "Notifications" },
  { key: "integrations", label: "Integrations" },
  { key: "security", label: "Security" },
  { key: "team", label: "Team" },
]

interface SettingsClientProps {
  initialProfile: Record<string, unknown> | null
  email: string
  googleConnected: boolean
}

export default function SettingsClient({ initialProfile, email, googleConnected }: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState<Section>("business")
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
          Manage your business profile, team, and integrations
        </p>
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[200px_1fr] lg:gap-10">
        <nav className="flex lg:flex-col gap-1 pb-4 lg:pb-0 border-b lg:border-b-0 overflow-x-auto">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
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
          {activeSection === "business" && (
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
          {activeSection === "notifications" && <NotificationsSection />}
          {activeSection === "integrations" && <IntegrationsSection />}
          {activeSection === "security" && <SecuritySection email={email} googleConnected={googleConnected} />}
          {activeSection === "team" && <TeamSection />}
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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

function NotificationsSection() {
  return (
    <SectionCard title="Notifications" description="Which events trigger alerts">
      <div className="space-y-3">
        {[
          { label: "Risk flags raised", desc: "When AI detects a new risk pattern" },
          { label: "Document viewed", desc: "When a client opens a proposal or contract" },
          { label: "Document signed", desc: "When a client signs or accepts" },
          { label: "Deal stage changes", desc: "When a deal moves to a new stage" },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-lg border p-3 opacity-60">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground rounded-full border bg-muted px-1.5 py-0.5">Coming soon</span>
              <div className="h-5 w-9 rounded-full bg-muted-foreground/20 cursor-not-allowed" title="Coming soon" />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function IntegrationsSection() {
  return (
    <SectionCard title="Integrations" description="API keys and connected accounts">
      <div className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-center justify-between rounded-lg border p-3 opacity-60">
          <div>
            <p className="text-sm font-medium text-foreground">API Key</p>
            <p className="text-xs text-muted-foreground">Access your data programmatically</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground rounded-full border bg-muted px-1.5 py-0.5">Coming soon</span>
            <Button variant="outline" size="sm" disabled title="Coming soon">
              Generate
            </Button>
          </div>
        </div>
        <p className="text-xs">
          API access and webhook integrations are coming soon.
        </p>
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

function SecuritySection({ email, googleConnected }: { email: string; googleConnected: boolean }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Account Security" description="Password, sessions, and account recovery">
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-email">Email</Label>
            <Input id="settings-email" value={email} readOnly className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Used for sign-in and notifications</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 opacity-60">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">Last changed —</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground rounded-full border bg-muted px-1.5 py-0.5">Coming soon</span>
              <Button variant="outline" size="sm" disabled title="Coming soon">
                Change
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 opacity-60">
            <div>
              <p className="text-sm font-medium">Two-factor authentication</p>
              <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground rounded-full border bg-muted px-1.5 py-0.5">Coming soon</span>
              <Button variant="outline" size="sm" disabled title="Coming soon">
                Set Up
              </Button>
            </div>
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
        </div>
      </SectionCard>
    </div>
  )
}

function TeamSection() {
  return (
    <SectionCard title="Team" description="Invite collaborators and manage roles">
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-dashed p-4 opacity-60">
          <div>
            <p className="text-sm font-medium">Invite team members</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Share access with collaborators, reviewers, or assistants
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground rounded-full border bg-muted px-1.5 py-0.5">Coming soon</span>
            <Button variant="outline" size="sm" disabled title="Coming soon">
              Invite
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Team management is coming soon. You&apos;ll be able to invite collaborators with
          view-only, editor, and admin roles.
        </p>
      </div>
    </SectionCard>
  )
}
