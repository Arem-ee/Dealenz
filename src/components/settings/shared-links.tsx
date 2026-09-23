"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Copy, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { listShareTokens, revokeShareToken, type SharedLinkRow } from "@/app/audit/[id]/actions"

function linkStatus(l: SharedLinkRow): "revoked" | "expired" | "active" {
  if (l.revokedAt) return "revoked"
  if (l.expiresAt && new Date(l.expiresAt).getTime() < Date.now()) return "expired"
  return "active"
}

function linkUrl(token: string, kind: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return kind === "report" ? `${origin}/report/${token}` : `${origin}/view/${token}`
}

function kindLabel(kind: string): string {
  if (kind === "report") return "Findings report"
  return `${kind.charAt(0).toUpperCase() + kind.slice(1)} shared view`
}

// Every link this account ever published, in one place: what it opens,
// whether it still works, and a revoke switch. Counterparty signing
// invitations live with their documents in the signing workspace, not here.
export function SharedLinksCard() {
  const [links, setLinks] = useState<SharedLinkRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await listShareTokens()
      if (cancelled) return
      if (!res.ok) {
        setError(res.error)
        setLinks([])
        return
      }
      setLinks(res.links)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(id)
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000)
    } catch {
      setError("Could not copy the link")
    }
  }

  async function revoke(id: string) {
    setRevoking(id)
    try {
      const res = await revokeShareToken(id)
      if (!res.success) {
        setError(res.error ?? "We couldn't revoke that link. Please try again.")
        return
      }
      setLinks((prev) =>
        (prev ?? []).map((l) => (l.id === id ? { ...l, revokedAt: new Date().toISOString() } : l))
      )
    } catch {
      setError("We couldn't revoke that link. Please try again.")
    } finally {
      setRevoking(null)
    }
  }

  if (links === null && !error) {
    return (
      <div className="space-y-2" aria-label="Loading shared links">
        <div className="h-12 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-12 animate-pulse rounded-xl bg-muted/60" />
      </div>
    )
  }

  if (error && (links === null || links.length === 0)) {
    return <p className="text-xs text-destructive">{error}</p>
  }

  const rows = links ?? []
  if (rows.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        No shared links yet. Links you create from a deal&apos;s share actions will appear here,
        with a revoke switch each.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {rows.map((l) => {
        const status = linkStatus(l)
        const url = linkUrl(l.token, l.kind)
        return (
          <li
            key={l.id}
            className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5"
          >
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">
                <Link href={`/chat/${l.auditId}`} className="hover:underline">
                  {l.dealTitle}
                </Link>
                <span className="font-normal text-muted-foreground"> · {kindLabel(l.kind)}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {status === "active" && <>Active{l.expiresAt ? ` · expires ${new Date(l.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</>}
                {status === "expired" && "Expired — the link no longer opens anything."}
                {status === "revoked" && "Revoked — the link no longer opens anything."}
              </p>
            </div>
            {status === "active" && (
              <span className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void copy(url, l.id)}
                  aria-label={`Copy link for ${l.dealTitle}`}
                  className="h-8 px-2"
                >
                  {copied === l.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoking === l.id}
                  onClick={() => void revoke(l.id)}
                  className="h-8 text-xs"
                >
                  {revoking === l.id ? "Revoking…" : "Revoke"}
                </Button>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
