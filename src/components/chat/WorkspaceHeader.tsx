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
  jurisdiction: _jurisdiction,
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
      {/* Jurisdiction already shows in the overview meta; repeating it here
          crowded the narrow panel. Documents and monitoring read as inline
          text links, not pills: hierarchy from type, not chrome. */}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {auditId && (documentCount ?? 0) > 0 && (
          <Link
            href={`/document/${auditId}`}
            className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            <FileText className="h-3 w-3" />
            Documents{documentCount ? ` (${documentCount})` : ""}
          </Link>
        )}
        {monitoring && monitoring.total > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
            <Bell className="h-3 w-3" />
            Monitoring: {monitoring.unresolved > 0 ? `${monitoring.unresolved} need attention` : `${monitoring.total} watched`}
          </span>
        )}
      </div>
    </div>
  )
}
