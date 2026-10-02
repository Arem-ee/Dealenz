"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { FileText, Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { kindOfFamily, listDrafts, type DraftKind, type DraftVersionRow } from "@/app/(app)/drafts/actions"
import { useToast } from "@/components/ui/toast"

const KINDS: DraftKind[] = ["Agreements", "Terms", "Schedules"]

function formatDate(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ""
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// Drafts: every generated document with versions. Standard merge output —
// template plus autofilled data plus blanks — reviewed before anything
// moves toward signature.
export function DraftsView() {
  const { showError } = useToast()
  const [drafts, setDrafts] = useState<DraftVersionRow[] | null>(null)
  const [kind, setKind] = useState<DraftKind | "All">("All")

  useEffect(() => {
    let live = true
    listDrafts()
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          showError(res.error, "Drafts failed to load")
          setDrafts([])
          return
        }
        setDrafts(res.drafts)
      })
      .catch(() => {
        if (!live) return
        showError("Drafts failed to load")
        setDrafts([])
      })
    return () => {
      live = false
    }
  }, [showError])

  const counts = useMemo(() => {
    const c: Record<DraftKind, number> = { Agreements: 0, Terms: 0, Schedules: 0 }
    for (const d of drafts ?? []) c[kindOfFamily(d.familyId)] += 1
    return c
  }, [drafts])

  const visible = useMemo(
    () => (drafts ?? []).filter((d) => kind === "All" || kindOfFamily(d.familyId) === kind),
    [drafts, kind]
  )

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Drafts</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Generated documents, every version kept.
          </p>
        </div>
        <Link
          href="/chat/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New document
        </Link>
      </div>

      {drafts === null ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading drafts…
        </div>
      ) : drafts.length === 0 ? (
        <div className="border border-dashed px-4 py-12 text-center">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No drafts yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Generate a document from a deal and it lands here with its versions.
          </p>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-4" aria-label="Filter by kind">
            {(["All", ...KINDS] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={cn(
                  "border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                  kind === k
                    ? "border-foreground bg-muted font-semibold text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {k}{k !== "All" ? ` · ${counts[k]}` : ""}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <div className="border border-dashed px-4 py-12 text-center">
              <p className="text-sm font-medium">No drafts match.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-border" role="table" aria-label="Drafts">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-semibold">Document</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Deal</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Version</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((d) => (
                    <tr key={d.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-3 py-2.5 font-medium">{d.familyTitle}</td>
                      <td className="max-w-[220px] truncate px-3 py-2.5 text-[13px] text-muted-foreground">{d.dealTitle}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[13px] tabular-nums">v{d.versionNumber}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[13px] capitalize">{(d.status ?? "draft").replaceAll("_", " ")}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-[13px] tabular-nums text-muted-foreground">{formatDate(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
            {visible.length} of {drafts.length} shown.
          </p>
        </>
      )}
    </div>
  )
}
