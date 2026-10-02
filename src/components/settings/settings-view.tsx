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
            <section aria-label="Billing">
              <h2 className="text-sm font-semibold">Billing</h2>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plan</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">—</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Allowance used</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">—</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invoices</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">None yet.</dd>
                </div>
              </dl>
              <p className="mt-4 text-[11px] text-muted-foreground">Plan, usage bar, payment method, and fair cancel wire up with functions. Cancellation is never buried.</p>
            </section>
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
