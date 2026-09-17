"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { getVaultList } from "@/app/vault/actions"

interface Row {
  id: string
  title: string
  dealType: string | null
  createdAt: string
  updatedAt: string
  riskLevel: string | null
  overallScore: number | null
}

export function VaultListFallback() {
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getVaultList(q).then((r) => {
      if (!cancelled) {
        setRows(r as Row[])
        setLoading(false)
      }
    }).catch(() => setLoading(false))
    return () => { cancelled = true }
  }, [q])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h3 className="text-sm font-semibold">Browse your vault</h3>
      <p className="text-xs text-muted-foreground">Simple list — search by title or deal type. Chat above is the primary way to ask about your vault.</p>
      <div className="mt-3 relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by title, deal type..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 h-9 text-sm" />
      </div>
      <div className="mt-4 space-y-2">
        {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-xs text-muted-foreground">No deals found.</p> : rows.slice(0, 20).map((r) => (
          <Link key={r.id} href={`/chat/${r.id}`} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/50">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.dealType ?? "deal"} · {new Date(r.updatedAt).toLocaleDateString()} {r.riskLevel ? `· ${r.riskLevel}` : ""}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
