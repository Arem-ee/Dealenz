"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { addKey, listKeys, revokeKey, rotateKey } from "@/app/(app)/settings/actions"
import type { ModelKeyRow } from "@/lib/models/store"

const SECTIONS = ["Profile", "Language", "Models", "Billing", "Notifications"] as const
type Section = (typeof SECTIONS)[number]

// Settings foreground: personal layer only. Values display where readable;
// key management is fully wired (encrypted storage, revoke, rotate).
// Other edits wire up with backend functions. Destructive actions live
// only in the danger zone with intent-proving confirmation.
export function SettingsView({ email }: { email: string }) {
  const [section, setSection] = useState<Section>("Profile")

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="shrink-0 pb-4 pt-6">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Personal layer. Teams live in the Team tab, never here.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-px border border-border bg-border md:flex-row">
        <nav className="flex shrink-0 flex-row gap-0.5 overflow-x-auto bg-background p-1.5 md:w-48 md:flex-col" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              aria-current={section === s ? "page" : undefined}
              className={cn(
                "whitespace-nowrap px-3 py-2 text-left text-[13px] transition-colors",
                section === s
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto bg-background p-4 sm:p-6">
          {section === "Profile" && (
            <section aria-label="Profile">
              <h2 className="text-sm font-semibold">Profile</h2>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email</dt>
                  <dd className="mt-0.5 text-sm">{email}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Display name</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">—</dd>
                </div>
              </dl>
              <p className="mt-4 text-[11px] text-muted-foreground">Edits wire up with functions. Identity changes stay guarded and confirmed.</p>
            </section>
          )}

          {section === "Language" && (
            <section aria-label="Language">
              <h2 className="text-sm font-semibold">Language & region</h2>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Interface language</dt>
                  <dd className="mt-0.5 text-sm">English</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Region & timezone</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">—</dd>
                </div>
              </dl>
              <p className="mt-4 text-[11px] text-muted-foreground">Language preference is display-only; compliance locale stays separate.</p>
            </section>
          )}

          {section === "Models" && (
            <ModelsSection />
          )}

          {section === "Billing" && (
            <BillingSection />
          )}

          {section === "Notifications" && (
            <section aria-label="Notifications">
              <h2 className="text-sm font-semibold">Notifications</h2>
              <ul className="mt-3 space-y-3">
                {["Deadline digests", "Approval requests", "Product updates"].map((n) => (
                  <li key={n} className="flex items-center justify-between gap-3 border border-border px-3 py-2.5">
                    <span className="text-sm">{n}</span>
                    <span className="text-[11px] text-muted-foreground">On</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] text-muted-foreground">Per-category control, low-noise defaults. Toggles persist with functions.</p>
            </section>
          )}
        </div>
      </div>

      <section aria-label="Danger zone" className="mt-4 border border-brick-700/40 p-4">
        <h2 className="text-sm font-semibold text-brick-700">Danger zone</h2>
        <p className="mt-1 text-xs text-muted-foreground">Cancel subscription and delete workspace live here alone — each with intent-proving confirmation. Nothing destructive exists anywhere else in Settings.</p>
      </section>
    </div>
  )
}

function ModelsSection() {
  const [keys, setKeys] = useState<ModelKeyRow[] | null>(null)
  const [storageReady, setStorageReady] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [provider, setProvider] = useState("anthropic")
  const [label, setLabel] = useState("")
  const [secret, setSecret] = useState("")
  const [models, setModels] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const [rotateSecret, setRotateSecret] = useState("")

  const refresh = async () => {
    try {
      const res = await listKeys()
      if (!res.ok) {
        setLoadError(res.error)
        setKeys([])
        return
      }
      setKeys(res.keys)
      setStorageReady(res.storageReady)
    } catch {
      setLoadError("We couldn't load your keys.")
      setKeys([])
    }
  }

  useEffect(() => {
    let live = true
    listKeys()
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          setLoadError(res.error)
          setKeys([])
          return
        }
        setKeys(res.keys)
        setStorageReady(res.storageReady)
      })
      .catch(() => {
        if (!live) return
        setLoadError("We couldn't load your keys.")
        setKeys([])
      })
    return () => {
      live = false
    }
  }, [])

  async function add() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await addKey({ provider, label, secret, models, baseUrl })
      if (!res.ok) throw new Error(res.error)
      setLabel("")
      setSecret("")
      setModels("")
      setBaseUrl("")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that key.")
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await revokeKey({ id })
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't revoke that key.")
    } finally {
      setBusy(false)
    }
  }

  async function rotate(id: string) {
    if (busy || !rotateSecret.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await rotateKey({ id, secret: rotateSecret })
      if (!res.ok) throw new Error(res.error)
      setRotateSecret("")
      setRotatingId(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't rotate that key.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Model keys">
      <h2 className="text-sm font-semibold">Model keys</h2>
      <p className="mt-1 text-xs text-muted-foreground">Bring your own keys. Encrypted at rest, decrypted only for the live call, never displayed — not even to you. Revoking kills use immediately.</p>

      {keys === null ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading keys…
        </p>
      ) : (
        <>
          {!storageReady && (
            <p role="alert" className="mt-3 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
              Key storage isn&apos;t set up yet (migration 00092) — keys can&apos;t be saved until it is.
            </p>
          )}
          {loadError && (
            <p role="alert" className="mt-3 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">{loadError}</p>
          )}
          {keys.length === 0 ? (
            <div className="mt-3 border border-dashed px-4 py-8 text-center">
              <p className="text-sm font-medium">No keys added</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Add one below — it appears in the composer&apos;s Model menu.</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {keys.map((k) => (
                <li key={k.id} className="border border-border px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{k.label}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {k.provider} · {k.models.length > 0 ? k.models.join(", ") : "no models"}
                        {k.last_error ? ` · needs attention: ${k.last_error.slice(0, 80)}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void revoke(k.id)}
                      disabled={busy}
                      className="shrink-0 px-2 py-1 text-[11px] font-medium text-destructive hover:underline disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                  {rotatingId === k.id ? (
                    <div className="mt-2 flex gap-1.5">
                      <input
                        value={rotateSecret}
                        onChange={(e) => setRotateSecret(e.target.value)}
                        type="password"
                        autoComplete="off"
                        placeholder="New secret"
                        aria-label={`New secret for ${k.label}`}
                        className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void rotate(k.id)}
                        disabled={busy || !rotateSecret.trim()}
                        className="h-8 shrink-0 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRotatingId(null)
                          setRotateSecret("")
                        }}
                        className="h-8 shrink-0 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRotatingId(k.id)}
                      className="mt-1 px-0 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Rotate secret
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border border-border p-3" aria-label="Add a key">
            <p className="text-[13px] font-medium">Add a key</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-[11px] text-muted-foreground">
                Provider
                <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={busy || !storageReady} className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground disabled:opacity-60">
                  <option value="anthropic">Anthropic</option>
                  <option value="openai_compatible">OpenAI-compatible</option>
                  <option value="gemini">Gemini</option>
                </select>
              </label>
              <label className="block text-[11px] text-muted-foreground">
                Name
                <input value={label} onChange={(e) => setLabel(e.target.value)} disabled={busy || !storageReady} placeholder="e.g. Team Claude key" autoComplete="off" className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground outline-none disabled:opacity-60" />
              </label>
              <label className="block text-[11px] text-muted-foreground sm:col-span-2">
                Secret
                <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" disabled={busy || !storageReady} autoComplete="off" className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground outline-none disabled:opacity-60" />
              </label>
              <label className="block text-[11px] text-muted-foreground sm:col-span-2">
                Models, comma-separated
                <input value={models} onChange={(e) => setModels(e.target.value)} disabled={busy || !storageReady} placeholder="claude-sonnet-4-5-20250929" autoComplete="off" className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground outline-none disabled:opacity-60" />
              </label>
              {provider === "openai_compatible" && (
                <label className="block text-[11px] text-muted-foreground sm:col-span-2">
                  Endpoint <span className="font-normal">(blank means api.openai.com)</span>
                  <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} disabled={busy || !storageReady} placeholder="https://api.openai.com/v1" autoComplete="off" className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground outline-none disabled:opacity-60" />
                </label>
              )}
            </div>
            {error && <p role="alert" className="mt-2 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">{error}</p>}
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy || !storageReady}
              className="mt-2 inline-flex h-9 items-center bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save key
            </button>
          </div>
        </>
      )}
    </section>
  )
}

interface PaddleCheckout {
  Setup: (options: { token: string }) => void
  Environment: { set: (env: string) => void }
  Checkout: { open: (options: unknown) => void }
}

declare global {
  interface Window {
    Paddle?: PaddleCheckout
  }
}

function loadPaddle(): Promise<PaddleCheckout> {
  if (typeof window !== "undefined" && window.Paddle) return Promise.resolve(window.Paddle)
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js"
    script.async = true
    script.onload = () => {
      if (window.Paddle) resolve(window.Paddle)
      else reject(new Error("Checkout failed to load."))
    }
    script.onerror = () => reject(new Error("Checkout failed to load. Check your connection and try again."))
    document.head.appendChild(script)
  })
}

// Org pool plan: recurring allowance for the shared pool, metered org
// overage invoiced to the owner. Owner-only mutations; members read.
function OrgPlanSection() {
  const [orgs, setOrgs] = useState<Array<{ orgId: string; orgName: string; role: string }>>([])
  const [orgId, setOrgId] = useState("")
  const [state, setState] = useState<{
    subscription: {
      id: string
      plan_id: string
      plan_label: string
      status: string
      currency: string
      monthly_allowance: number
      used_allowance: number
      overage_credits: number
      overage_allowed: boolean
      period_end: string
    } | null
    poolBalance: number | null
    plans: Array<{ id: string; monthlyAllowance: number; description: string }>
    checkoutConfigured: boolean
    invoices: Array<{
      id: string
      period_start: string
      period_end: string
      overage_credits: number
      amount_minor: number
      currency: string
      status: string
    }>
  } | null>(null)
  const [currency, setCurrency] = useState("USD")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cancelArmed, setCancelArmed] = useState(false)

  useEffect(() => {
    let live = true
    import("@/lib/orgs/actions")
      .then(({ listMyOrganizations }) => listMyOrganizations())
      .then((res) => {
        if (!live) return
        if (res.ok) {
          setOrgs(res.orgs)
          const owned = res.orgs.find((o) => o.role === "owner")
          if (owned) setOrgId(owned.orgId)
          else if (res.orgs.length > 0) setOrgId(res.orgs[0]!.orgId)
        }
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!orgId) return
    let live = true
    import("@/lib/billing/org-billing-actions")
      .then(({ getOrgBillingState }) => getOrgBillingState(orgId))
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          setError(res.error)
          return
        }
        setState({
          subscription: res.subscription,
          poolBalance: res.poolBalance,
          plans: res.plans,
          checkoutConfigured: res.checkoutConfigured,
          invoices: res.invoices,
        })
      })
      .catch(() => {
        if (!live) return
        setError("We couldn't load the pool plan.")
      })
    return () => {
      live = false
    }
  }, [orgId])

  const isOwner = orgs.find((o) => o.orgId === orgId)?.role === "owner"
  const sub = state?.subscription ?? null

  async function subscribe(planId: string) {
    if (busy || !orgId) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { startOrgSubscriptionCheckout } = await import("@/lib/billing/org-billing-actions")
      const res = await startOrgSubscriptionCheckout({ orgId, planId, currency })
      if (!res.ok) throw new Error(res.error)
      const paddle = await loadPaddle()
      if (res.environment === "sandbox") {
        try {
          paddle.Environment.set("sandbox")
        } catch {
          // Production token with a sandbox flag — Setup still validates.
        }
      }
      paddle.Setup({ token: res.clientToken })
      paddle.Checkout.open({
        items: [{ priceId: res.priceId, quantity: 1 }],
        customer: { email: res.email },
        customData: res.customData,
      })
      setNotice("Checkout opened — the pool plan activates when payment completes. Refresh after.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.")
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (busy || !orgId) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { cancelOrgSubscription } = await import("@/lib/billing/org-billing-actions")
      const res = await cancelOrgSubscription(orgId)
      if (!res.ok) throw new Error(res.error)
      setCancelArmed(false)
      setNotice("Cancellation requested — pool allowance runs to period end, then stops.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellation failed — the plan is unchanged.")
    } finally {
      setBusy(false)
    }
  }

  async function flipOverage(optIn: boolean) {
    if (busy || !orgId) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { setOrgOverageAllowed } = await import("@/lib/billing/org-billing-actions")
      const res = await setOrgOverageAllowed(orgId, optIn)
      if (!res.ok) throw new Error(res.error)
      setNotice(optIn ? "Pool overage billing is on — metered past allowance, invoiced to you each period." : "Pool overage billing is off — hard cap restored.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change overage billing.")
    } finally {
      setBusy(false)
    }
  }

  async function pay(id: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { settleOrgOverageInvoiceAction } = await import("@/lib/billing/org-billing-actions")
      const res = await settleOrgOverageInvoiceAction(id)
      if (!res.ok) throw new Error(res.error)
      setNotice("Payment started — the invoice flips to paid when Paddle confirms.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed — the invoice is unchanged.")
    } finally {
      setBusy(false)
    }
  }

  if (orgs.length === 0) return null

  return (
    <div className="mt-4 border border-border p-3" aria-label="Pool plan">
      <p className="text-[13px] font-medium">Pool plan</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Recurring allowance for the shared pool. Only the organization owner can change it — members read.
      </p>
      <label className="mt-2 block text-[11px] text-muted-foreground">
        Organization
        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} disabled={busy} className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground disabled:opacity-60">
          {orgs.map((o) => (
            <option key={o.orgId} value={o.orgId}>{o.orgName} · {o.role}</option>
          ))}
        </select>
      </label>
      {!state ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading pool plan…</p>
      ) : (
        <>
          <p className="mt-2 text-xs tabular-nums text-muted-foreground">
            Pool balance: {typeof state.poolBalance === "number" ? `${state.poolBalance} credits` : "—"}
            {sub && <> · {sub.used_allowance} of {sub.monthly_allowance} used{sub.overage_credits > 0 && <> · <span className="font-semibold text-destructive">+{sub.overage_credits} overage</span></>}</>}
          </p>
          {!sub ? (
            isOwner ? (
              state.checkoutConfigured ? (
                <>
                  <label className="mt-2 block text-[11px] text-muted-foreground">
                    Currency
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={busy} className="mt-1 h-9 w-32 border border-input bg-background px-2 text-xs text-foreground disabled:opacity-60">
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>
                  <div className="mt-2 space-y-1.5">
                    {state.plans.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 border border-border px-2.5 py-2">
                        <div>
                          <p className="text-[13px] font-medium capitalize">{p.id}</p>
                          <p className="text-[11px] text-muted-foreground">{p.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void subscribe(p.id)}
                          disabled={busy}
                          className="h-8 shrink-0 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                        >
                          Subscribe pool
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">Pool plans open soon.</p>
              )
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">No pool plan — only the organization owner can subscribe.</p>
            )
          ) : (
            <>
              <p className="mt-2 text-xs">
                {sub.plan_label} · {sub.status.replaceAll("_", " ")} · renews {new Date(sub.period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
              {isOwner && (
                <>
                  <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={sub.overage_allowed}
                      onChange={(e) => void flipOverage(e.target.checked)}
                      disabled={busy}
                      className="mt-0.5 h-3.5 w-3.5 accent-foreground"
                    />
                    <span className="text-muted-foreground">
                      Meter pool overage past allowance (bounded at one allowance, invoiced to you each period).
                    </span>
                  </label>
                  {state.invoices.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {state.invoices.map((inv) => (
                        <li key={inv.id} className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                          <span className="min-w-0 flex-1">
                            {inv.overage_credits} credits · {(inv.amount_minor / 100).toFixed(2)} {inv.currency} · {inv.status}
                          </span>
                          {(inv.status === "pending" || inv.status === "failed") && (
                            <button
                              type="button"
                              onClick={() => void pay(inv.id)}
                              disabled={busy}
                              className="shrink-0 border border-border px-2 py-1 text-[11px] hover:text-foreground disabled:opacity-50"
                            >
                              Pay now
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {sub.status !== "canceled" && (
                    !cancelArmed ? (
                      <button
                        type="button"
                        onClick={() => setCancelArmed(true)}
                        className="mt-2 text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        Cancel pool plan
                      </button>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void cancel()}
                          disabled={busy}
                          className="inline-flex h-8 items-center bg-destructive px-3 text-[11px] font-semibold text-destructive-foreground disabled:opacity-40"
                        >
                          {busy ? "Canceling…" : "Yes, cancel at period end"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelArmed(false)}
                          className="inline-flex h-8 items-center px-2 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          Keep plan
                        </button>
                      </div>
                    )
                  )}
                </>
              )}
            </>
          )}
          {error && <p role="alert" className="mt-2 border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">{error}</p>}
          {notice && <p role="status" className="mt-2 border border-border bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">{notice}</p>}
        </>
      )}
    </div>
  )
}

// Buy packs: solo top-up or pool funding (owners/admins pick a pool).
// Posts to the pack checkout route and follows the provider URL.
function BuyPacks({ busy, setBusy, setError, fundableOrgs }: {
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (v: string | null) => void
  fundableOrgs: Array<{ orgId: string; orgName: string }>
}) {
  const [packId, setPackId] = useState("standard")
  const [currency, setCurrency] = useState("USD")
  const [orgId, setOrgId] = useState("")

  async function buy() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: packId, currency, ...(orgId ? { orgId } : {}) }),
      })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !data?.url) throw new Error(data?.error ?? "Checkout failed.")
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 border border-border p-3" aria-label="Buy credits">
      <p className="text-[13px] font-medium">Buy credits</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        One-time packs. Never expire. Target a pool to fund it instead of your solo balance.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block text-[11px] text-muted-foreground">
          Pack
          <select value={packId} onChange={(e) => setPackId(e.target.value)} disabled={busy} className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground disabled:opacity-60">
            <option value="starter">Starter · 50</option>
            <option value="standard">Standard · 150</option>
            <option value="pro">Pro · 400</option>
          </select>
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Currency
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={busy} className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground disabled:opacity-60">
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Fund
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} disabled={busy} className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground disabled:opacity-60">
            <option value="">Solo balance</option>
            {fundableOrgs.map((o) => (
              <option key={o.orgId} value={o.orgId}>{o.orgName} pool</option>
            ))}
          </select>
        </label>
      </div>
      {fundableOrgs.length === 0 && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">Pool funding needs an organization you own or administer.</p>
      )}
      <button
        type="button"
        onClick={() => void buy()}
        disabled={busy}
        className="mt-2 inline-flex h-9 items-center bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
      >
        Buy pack
      </button>
    </div>
  )
}

// Billing: live subscription state, allowance usage, overage opt-in with
// per-period invoices, cancellation at period end, pack history, and pack
// purchase (solo or pool funding). Hard cap by default, stated plainly;
// overage meters past it when opted in, bounded at one allowance,
// invoiced and settled through Paddle.
function BillingSection() {
  const [state, setState] = useState<{
    subscription: {
      id: string
      plan_id: string
      plan_label: string
      status: string
      currency: string
      monthly_allowance: number
      used_allowance: number
      overage_credits: number
      overage_allowed: boolean
      period_end: string
      renews: boolean
    } | null
    balance: number | null
    plans: Array<{ id: string; monthlyAllowance: number; description: string }>
    checkoutConfigured: boolean
    purchases: Array<{ package_id: string; currency: string; amount_minor: number; credits: number; status: string; created_at: string }>
  } | null>(null)
  const [invoices, setInvoices] = useState<Array<{
    id: string
    period_start: string
    period_end: string
    overage_credits: number
    amount_minor: number
    currency: string
    status: string
    paddle_transaction_id: string | null
  }>>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currency, setCurrency] = useState("USD")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cancelArmed, setCancelArmed] = useState(false)
  const [fundableOrgs, setFundableOrgs] = useState<Array<{ orgId: string; orgName: string }>>([])

  const refresh = async () => {
    try {
      const { getBillingState, listOverageInvoices } = await import("@/lib/billing/subscription-actions")
      const res = await getBillingState()
      if (!res.ok) {
        setLoadError(res.error)
        return
      }
      setState({
        subscription: res.subscription,
        balance: res.balance,
        plans: res.plans,
        checkoutConfigured: res.checkoutConfigured,
        purchases: res.purchases,
      })
      const inv = await listOverageInvoices()
      if (inv.ok) setInvoices(inv.invoices)
    } catch {
      setLoadError("We couldn't load billing.")
    }
  }

  useEffect(() => {
    let live = true
    import("@/lib/billing/subscription-actions")
      .then(({ getBillingState, listOverageInvoices, getScopeState }) => Promise.all([getBillingState(), listOverageInvoices(), getScopeState()]))
      .then(([res, inv, scope]) => {
        if (!live) return
        if (!res.ok) {
          setLoadError(res.error)
          return
        }
        setState({
          subscription: res.subscription,
          balance: res.balance,
          plans: res.plans,
          checkoutConfigured: res.checkoutConfigured,
          purchases: res.purchases,
        })
        if (inv.ok) setInvoices(inv.invoices)
        if (scope.ok) {
          setFundableOrgs(scope.orgs.filter((o) => o.canFund).map((o) => ({ orgId: o.orgId, orgName: o.orgName })))
        }
      })
      .catch(() => {
        if (!live) return
        setLoadError("We couldn't load billing.")
      })
    return () => {
      live = false
    }
  }, [])

  async function subscribe(planId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { startSubscriptionCheckout } = await import("@/lib/billing/subscription-actions")
      const res = await startSubscriptionCheckout({ planId, currency })
      if (!res.ok) throw new Error(res.error)
      const paddle = await loadPaddle()
      if (res.environment === "sandbox") {
        try {
          paddle.Environment.set("sandbox")
        } catch {
          // Production token with a sandbox flag — Setup still validates.
        }
      }
      paddle.Setup({ token: res.clientToken })
      paddle.Checkout.open({
        items: [{ priceId: res.priceId, quantity: 1 }],
        customer: { email: res.email },
        customData: res.customData,
      })
      setNotice("Checkout opened — your plan activates when payment completes. Refresh this page after.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.")
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { cancelSubscription } = await import("@/lib/billing/subscription-actions")
      const res = await cancelSubscription()
      if (!res.ok) throw new Error(res.error)
      setCancelArmed(false)
      setNotice("Cancellation requested — allowance runs to period end, then stops. Packs keep working anytime.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellation failed — your subscription is unchanged.")
    } finally {
      setBusy(false)
    }
  }

  async function flipOverage(optIn: boolean) {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { setOverageAllowed } = await import("@/lib/billing/subscription-actions")
      const res = await setOverageAllowed(optIn)
      if (!res.ok) throw new Error(res.error)
      setNotice(optIn ? "Overage billing is on — metered past allowance, invoiced each period." : "Overage billing is off — hard cap restored.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change overage billing.")
    } finally {
      setBusy(false)
    }
  }

  async function payInvoice(id: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { settleOverageInvoiceAction, listOverageInvoices } = await import("@/lib/billing/subscription-actions")
      const res = await settleOverageInvoiceAction(id)
      if (!res.ok) throw new Error(res.error)
      setNotice("Payment started — the invoice flips to paid when Paddle confirms.")
      const inv = await listOverageInvoices()
      if (inv.ok) setInvoices(inv.invoices)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed — the invoice is unchanged.")
    } finally {
      setBusy(false)
    }
  }

  const sub = state?.subscription ?? null

  return (
    <section aria-label="Billing">
      <h2 className="text-sm font-semibold">Billing</h2>
      {loadError ? (
        <p role="alert" className="mt-3 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">{loadError}</p>
      ) : !state ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading billing…</p>
      ) : (
        <>
          <dl className="mt-3 space-y-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plan</dt>
              <dd className="mt-0.5 text-sm">{sub ? `${sub.plan_label} · ${sub.status.replaceAll("_", " ")}` : "Pay as you go (packs)"}</dd>
            </div>
            {sub && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Allowance used · renews {new Date(sub.period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </dt>
                <dd className="mt-1.5">
                  <span className="block h-2 w-full max-w-xs bg-muted">
                    <span
                      className="block h-full bg-foreground"
                      style={{ width: `${sub.monthly_allowance > 0 ? Math.min(100, Math.round((sub.used_allowance / sub.monthly_allowance) * 100)) : 0}%` }}
                    />
                  </span>
                  <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                    {sub.used_allowance} of {sub.monthly_allowance} credits
                    {sub.overage_credits > 0 && (
                      <> · <span className="font-semibold text-destructive">+{sub.overage_credits} overage</span></>
                    )}
                  </span>
                </dd>
              </div>
            )}
            {sub && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Overage billing</dt>
                <dd className="mt-1.5">
                  <label className="flex cursor-pointer items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={sub.overage_allowed}
                      onChange={(e) => void flipOverage(e.target.checked)}
                      disabled={busy}
                      className="mt-0.5 h-3.5 w-3.5 accent-foreground"
                    />
                    <span className="text-muted-foreground">
                      Keep working past my allowance and bill the overage each period
                      (per-credit rate, metered to one allowance past zero, hard stop after).
                      Off means work pauses at zero.
                    </span>
                  </label>
                </dd>
              </div>
            )}
            {invoices.length > 0 && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Overage invoices</dt>
                <dd className="mt-0.5 text-sm">
                  <ul className="space-y-1.5">
                    {invoices.map((inv) => (
                      <li key={inv.id} className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                        <span className="min-w-0 flex-1">
                          {inv.overage_credits} credits · {(inv.amount_minor / 100).toFixed(2)} {inv.currency} · {inv.status} ·{" "}
                          {new Date(inv.period_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {" → "}
                          {new Date(inv.period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        {(inv.status === "pending" || inv.status === "failed") && (
                          <button
                            type="button"
                            onClick={() => void payInvoice(inv.id)}
                            disabled={busy}
                            className="shrink-0 border border-border px-2 py-1 text-[11px] hover:text-foreground disabled:opacity-50"
                          >
                            Pay now
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {typeof state.balance === "number" && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Balance</dt>
                <dd className="mt-0.5 text-sm tabular-nums">{state.balance} credits</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invoices</dt>
              <dd className="mt-0.5 text-sm">
                {state.purchases.length === 0 ? (
                  <span className="text-muted-foreground">None yet.</span>
                ) : (
                  <ul className="space-y-1">
                    {state.purchases.slice(0, 5).map((p, i) => (
                      <li key={i} className="text-xs tabular-nums text-muted-foreground">
                        {p.package_id} · {(p.amount_minor / 100).toFixed(2)} {p.currency} · {p.credits} credits · {p.status} ·{" "}
                        {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          </dl>

          {!sub && (
            <div className="mt-4 border border-border p-3" aria-label="Subscribe">
              <p className="text-[13px] font-medium">Subscribe for monthly allowance</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Use-or-lose every 30 days. Hard cap: work pauses when the balance runs out — packs top up anytime.
              </p>
              {!state.checkoutConfigured ? (
                <p className="mt-2 text-[11px] text-muted-foreground">Subscriptions open soon — packs work today.</p>
              ) : (
                <>
                  <label className="mt-2 block text-[11px] text-muted-foreground">
                    Currency
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={busy} className="mt-1 h-9 w-32 border border-input bg-background px-2 text-xs text-foreground disabled:opacity-60">
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>
                  <div className="mt-2 space-y-1.5">
                    {state.plans.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 border border-border px-2.5 py-2">
                        <div>
                          <p className="text-[13px] font-medium capitalize">{p.id}</p>
                          <p className="text-[11px] text-muted-foreground">{p.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void subscribe(p.id)}
                          disabled={busy}
                          className="h-8 shrink-0 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                        >
                          Subscribe
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {sub && sub.renews && (
            <div className="mt-4">
              {!cancelArmed ? (
                <button
                  type="button"
                  onClick={() => setCancelArmed(true)}
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Cancel subscription
                </button>
              ) : (
                <div className="border border-brick-700/40 p-3" aria-label="Confirm cancellation">
                  <p className="text-xs">Cancel at period end? Allowance stops renewing; packs keep working.</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void cancel()}
                      disabled={busy}
                      className="inline-flex h-8 items-center bg-destructive px-3 text-[11px] font-semibold text-destructive-foreground disabled:opacity-40"
                    >
                      {busy ? "Canceling…" : "Yes, cancel at period end"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelArmed(false)}
                      className="inline-flex h-8 items-center px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Keep plan
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p role="alert" className="mt-2 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">{error}</p>}
          {notice && <p role="status" className="mt-2 border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">{notice}</p>}

          <BuyPacks
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            fundableOrgs={fundableOrgs}
          />

          <OrgPlanSection />

          <p className="mt-4 text-[11px] text-muted-foreground">Cancellation is never buried — it lives here, two clicks, effective at period end.</p>
        </>
      )}
    </section>
  )
}
