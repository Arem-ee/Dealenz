"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const SECTIONS = ["Profile", "Language", "Models", "Billing", "Notifications"] as const
type Section = (typeof SECTIONS)[number]

// Settings foreground: personal layer only. Values display where readable;
// edits wire up with backend functions. Destructive actions live only in
// the danger zone with intent-proving confirmation.
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
            <section aria-label="Model keys">
              <h2 className="text-sm font-semibold">Model keys</h2>
              <p className="mt-1 text-xs text-muted-foreground">Bring your own keys. Secrets are encrypted and never displayed — not even to you.</p>
              <div className="mt-3 border border-dashed px-4 py-8 text-center">
                <p className="text-sm font-medium">No keys added</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Add, rotate, and revoke keys here once storage lands.</p>
              </div>
            </section>
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
