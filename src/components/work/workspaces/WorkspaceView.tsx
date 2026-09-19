"use client"

import type { WorkspaceMode } from "@/lib/work/workspace"
import type { PlanRow, PlanStepRow } from "@/lib/work/schema"
import type { WorkspaceData } from "./types"
import { ReviewWorkspace } from "./ReviewWorkspace"
import { ProposalWorkspace } from "./ProposalWorkspace"
import { NegotiationWorkspace } from "./NegotiationWorkspace"
import { ProtectionWorkspace } from "./ProtectionWorkspace"
import { SigningWorkspace } from "./SigningWorkspace"
import { MonitoringWorkspace } from "./MonitoringWorkspace"
import { BatchWorkspace } from "./BatchWorkspace"

// Objective workspaces: each mode renders a materially different surface
// from the same verified bundle. Modes without a dedicated surface return
// null and the caller falls back to the latest-card panel. Approval and
// execution keep the plan block plus card context instead of a workspace.
export function WorkspaceView({ mode, data, auditId, threadId, dealType, riskLevel, overallScore, plan, steps, onAsk, onGeneratePackage, onChanged }: {
  mode: WorkspaceMode
  data: WorkspaceData
  auditId?: string | null
  threadId: string
  dealType?: string | null
  riskLevel?: string
  overallScore?: number
  plan: PlanRow | null
  steps: PlanStepRow[]
  onAsk: (question: string) => void
  onGeneratePackage: () => void
  onChanged: () => void
}) {
  switch (mode) {
    case "review":
      return (
        <ReviewWorkspace
          data={data}
          dealType={dealType}
          riskLevel={riskLevel}
          overallScore={overallScore}
          onAskFinding={onAsk}
          onGenerateProtection={dealType === "freelance" ? onGeneratePackage : undefined}
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
          onGenerate={dealType === "freelance" ? onGeneratePackage : undefined}
        />
      )
    }
    case "negotiation":
      return <NegotiationWorkspace data={data} onAskFinding={onAsk} />
    case "protection":
      return (
        <ProtectionWorkspace
          data={data}
          dealType={dealType}
          onGenerate={dealType === "freelance" ? onGeneratePackage : undefined}
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
      ) : null
    case "batch":
      return auditId ? (
        <BatchWorkspace
          threadId={threadId}
          auditId={auditId}
          plan={plan}
          steps={steps}
          versions={data.versions}
          onChanged={onChanged}
        />
      ) : null
    default:
      return null
  }
}
