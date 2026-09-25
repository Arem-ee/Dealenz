"use client"

import type { WorkspaceMode } from "@/lib/work/workspace"
import type { WorkspaceData } from "./types"
import { ReviewWorkspace } from "./ReviewWorkspace"
import { ProposalWorkspace } from "./ProposalWorkspace"
import { NegotiationWorkspace } from "./NegotiationWorkspace"
import { ProtectionWorkspace } from "./ProtectionWorkspace"
import { SigningWorkspace } from "./SigningWorkspace"
import { MonitoringWorkspace } from "./MonitoringWorkspace"
import { hasProtectionDraftSupport } from "@/lib/protection"

// Objective workspaces: each mode renders a materially different surface
// from the same verified bundle. Modes without a dedicated surface return
// null and the caller falls back to the latest-card panel. Approval and
// execution keep the plan block plus card context instead of a workspace.
export function WorkspaceView({ mode, data, auditId, dealType, riskLevel, overallScore, onAsk, onGeneratePackage, onChanged }: {
  mode: WorkspaceMode
  data: WorkspaceData
  auditId?: string | null
  dealType?: string | null
  riskLevel?: string
  overallScore?: number
  onAsk: (question: string) => void
  onGeneratePackage: () => void
  onChanged: () => void
}) {
  // Document-capable verticals get the generate action: freelance (full
  // protection package) plus founder/partnership (family drafts). Other
  // verticals keep findings + negotiation + lawyer paths — never a dead end
  // with no next action.
  const canDraft = !!dealType && (dealType === "freelance" || hasProtectionDraftSupport(dealType))
  switch (mode) {
    case "review":
      return (
        <ReviewWorkspace
          data={data}
          dealType={dealType}
          riskLevel={riskLevel}
          overallScore={overallScore}
          auditId={auditId}
          onAskFinding={onAsk}
          onGenerateProtection={canDraft ? onGeneratePackage : undefined}
        />
      )
    case "proposal":
    case "draft": {
      // Lead with what actually exists: proposal versions, else SOW
      // versions, else the requested focus. Empty states stay honest.
      const hasProposal = data.versions.some((v) => v.document_type === "proposal")
      const hasSow = data.versions.some((v) => v.document_type === "sow")
      const focus = mode === "proposal" || hasProposal || !hasSow ? "proposal" : "sow"
      return (
        <ProposalWorkspace
          data={data}
          focus={focus}
          auditId={auditId}
          dealType={dealType}
          onGenerate={canDraft ? onGeneratePackage : undefined}
        />
      )
    }
    case "negotiation":
      return <NegotiationWorkspace data={data} auditId={auditId} onAskFinding={onAsk} />
    case "protection":
      return (
        <ProtectionWorkspace
          data={data}
          dealType={dealType}
          onGenerate={canDraft ? onGeneratePackage : undefined}
        />
      )
    case "signing":
      return <SigningWorkspace data={data} auditId={auditId} />
    case "monitoring":
      return auditId ? (
        <MonitoringWorkspace
          auditId={auditId}
          events={data.monitoringEvents}
          alerts={data.monitoringAlerts}
          gmailConnected={data.gmailConnected}
          onChanged={onChanged}
        />
      ) : (
        <p className="text-xs text-muted-foreground">Monitoring needs a deal attached. Analyze a deal first, then track its deadlines here.</p>
      )
    default:
      return null
  }
}
