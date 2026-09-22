"use client"

import Link from "next/link"
import { FileText, Bell } from "lucide-react"
import type { WorkspaceDescription } from "@/lib/work/workspace"

export interface MonitoringSummary {
  total: number
  unresolved: number
}

export function WorkspaceHeader({
  dealTitle,
  jurisdiction,
  workspace,
  auditId,
  documentCount,
  monitoring,
  compact,
}: {
  dealTitle?: string | null
  jurisdiction?: string | null
  workspace: WorkspaceDescription
  auditId?: string | null
  documentCount?: number | null
  monitoring?: MonitoringSummary | null
  compact?: boolean
}) {
  return (
    <div className={compact ? "px-4 pt-3" : "shrink-0 border-b border-border/60 px-4 py-3 sm:px-5"}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {dealTitle || "Deal workspace"}
      </p>
      <h2 className="mt-0.5 text-sm font-semibold">{workspace.title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{workspace.description}</p>
      {/* Deal type lives in the overview card; repeating it here crowded
          the narrow panel. Jurisdiction stays as compact context. */}
      {jurisdiction && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-[11px]">
            Jurisdiction: <span className="ml-1 font-medium">{jurisdiction}</span>
          </span>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {auditId && (documentCount ?? 0) > 0 && (
          <Link
            href={`/document/${auditId}`}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium hover:bg-muted/60"
          >
            <FileText className="h-3 w-3" />
            Documents{documentCount ? ` (${documentCount})` : ""}
          </Link>
        )}
        {monitoring && monitoring.total > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium">
            <Bell className="h-3 w-3" />
            Monitoring: {monitoring.unresolved > 0 ? `${monitoring.unresolved} need attention` : `${monitoring.total} watched`}
          </span>
        )}
      </div>
    </div>
  )
}
