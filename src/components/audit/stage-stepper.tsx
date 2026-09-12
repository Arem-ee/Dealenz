"use client"

import { Check, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  IconDeal,
  IconRiskFlag,
  IconProposal,
  IconSow,
  IconContract,
  IconChecklist,
} from "@/components/icons"

export type StageId =
  | "intake"
  | "risk-analysis"
  | "proposal"
  | "sow"
  | "contract"
  | "checklist"
  | "active"
  | "closed"
  | "documents"

export interface Stage {
  id: StageId
  label: string
  description: string
}

export const STAGES: Stage[] = [
  { id: "intake", label: "Intake", description: "Client brief and files" },
  { id: "risk-analysis", label: "Risk Analysis", description: "AI risk assessment" },
  { id: "proposal", label: "Proposal", description: "Project proposal" },
  { id: "sow", label: "Scope of Work", description: "Detailed scope" },
  { id: "contract", label: "Contract", description: "Protection contract" },
  { id: "checklist", label: "Checklist", description: "Deliverables checklist" },
  { id: "active", label: "Active Tracking", description: "Scope change guard" },
  { id: "closed", label: "Closed", description: "Deal outcome" },
]

export type DealTypeForStages =
  | "freelance"
  | "generic"
  | "lease"
  | "purchase_sale"
  | "employment"
  | "founder"
  | "partnership"

// Stage vocabulary follows actual backend capability per deal type:
// freelance has the proposal/sow/contract/checklist pipeline; all other
// deal types with documents get a neutral Documents stage; generic has no
// document stage at all (neutral representation, no invented stages).
const DOCUMENT_STAGE: Stage = { id: "documents", label: "Documents", description: "Drafts and finals" }

export function stagesForDealType(dealType: string): Stage[] {
  if (dealType === "freelance") return STAGES
  if (
    dealType === "founder" ||
    dealType === "partnership" ||
    dealType === "purchase_sale" ||
    dealType === "lease" ||
    dealType === "employment"
  ) {
    return [STAGES[0], STAGES[1], DOCUMENT_STAGE]
  }
  return [STAGES[0], STAGES[1]]
}

const stageIcons: Record<StageId, React.ElementType> = {
  intake: IconDeal,
  "risk-analysis": IconRiskFlag,
  proposal: IconProposal,
  sow: IconSow,
  contract: IconContract,
  checklist: IconChecklist,
  active: IconDeal,
  closed: Check,
  documents: IconContract,
}

export type StageState = "completed" | "current" | "locked" | "coming-soon"

export function getStageState(
  stage: Stage,
  currentStage: StageId,
  intakeComplete: boolean,
  riskComplete: boolean,
  documentsExist: boolean
): StageState {
  if (stage.id === "active" || stage.id === "closed") return "coming-soon"
  if (stage.id === currentStage) return "current"
  if (stage.id === "intake") return intakeComplete ? "completed" : "current"
  if (stage.id === "risk-analysis") return riskComplete ? "completed" : intakeComplete ? "current" : "locked"
  if (stage.id === "documents") {
    return documentsExist ? "completed" : riskComplete ? "current" : "locked"
  }
  if (["proposal", "sow", "contract", "checklist"].includes(stage.id)) {
    return documentsExist ? "completed" : riskComplete ? "current" : "locked"
  }
  return "locked"
}

interface StageStepperProps {
  currentStage: StageId
  intakeComplete: boolean
  riskComplete: boolean
  documentsExist: boolean
  onStageClick: (stage: StageId) => void
}

export function StageStepper({
  currentStage,
  intakeComplete,
  riskComplete,
  documentsExist,
  onStageClick,
  dealType = "freelance",
}: StageStepperProps & { dealType?: string }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {stagesForDealType(dealType).map((stage) => {
        const state = getStageState(stage, currentStage, intakeComplete, riskComplete, documentsExist)
        const Icon = stageIcons[stage.id]
        const isInteractive = state === "current" || state === "completed"

        return (
          <button
            key={stage.id}
            onClick={() => isInteractive && onStageClick(stage.id)}
            disabled={!isInteractive}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors",
              state === "current" && "bg-primary/10 text-primary",
              state === "completed" && "text-muted-foreground hover:bg-muted/50",
              state === "locked" && "text-muted-foreground/40 cursor-not-allowed",
              state === "coming-soon" && "text-muted-foreground/30 cursor-not-allowed"
            )}
          >
            <div className="flex items-center justify-center h-5 w-5 shrink-0">
              {state === "completed" ? (
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary" />
                </div>
              ) : state === "current" ? (
                <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
              ) : state === "coming-soon" ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className={cn(
                "text-sm truncate",
                state === "current" && "font-medium"
              )}>
                {stage.label}
              </p>
              <p className={cn(
                "text-xs truncate",
                state === "current" ? "text-primary/70" : "text-muted-foreground/60"
              )}>
                {state === "coming-soon" ? "Coming soon" : stage.description}
              </p>
            </div>
          </button>
        )
      })}
    </nav>
  )
}
