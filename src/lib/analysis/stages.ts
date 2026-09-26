// Analysis stage feed: turns analyzeDeal's phase log rows (system_logs)
// into the buyer-facing checklist shown while a document_analysis step runs.
// Pure mapping — no IO — so the labeling is unit-tested and the read action
// stays a thin ownership-checked query.

export type AnalysisStageState = "pending" | "active" | "done" | "failed"

export interface AnalysisStage {
  key: string
  label: string
  state: AnalysisStageState
}

interface StageDef {
  key: string
  label: string
  // Log phases that advance this stage, in pipeline order.
  phases: string[]
  // A failure row aborts the analysis (extraction, risk). Other phases log
  // failure but continue degraded (bad files are skipped, rules empty out,
  // negotiation points fall back) — their failure rows must never paint the
  // checklist red for an analysis that completes.
  fatalFailure: boolean
}

const STAGE_DEFS: StageDef[] = [
  { key: "reading", label: "Reading your deal", phases: ["knowledge", "file_processing"], fatalFailure: false },
  { key: "extracting", label: "Extracting the terms", phases: ["extraction"], fatalFailure: true },
  { key: "risk", label: "Rating the risks", phases: ["risk"], fatalFailure: true },
  { key: "rules", label: "Running rule checks", phases: ["rules"], fatalFailure: false },
  { key: "responses", label: "Drafting responses", phases: ["negotiation_points"], fatalFailure: false },
]

export interface StageLogRow {
  phase: string
  status: string
  created_at?: string
}

/**
 * Derives one state per stage from raw log rows. Latest row per phase wins;
 * success dominates failure (a phase that ultimately succeeded reads done,
 * never failed). A stage is done when it succeeded OR the pipeline demonstrably
 * moved past it (a later stage started) — degraded-but-continued phases
 * (skipped files, emptied rules) read done, not red. Fatal-phase failure
 * aborts the analysis and paints that stage failed. Exactly one stage is
 * ever active: the first started stage whose predecessors are all done.
 */
export function deriveAnalysisStages(rows: StageLogRow[], opts?: { expectsResponses?: boolean }): AnalysisStage[] {
  // Negotiation synthesis runs for every deal type except freelance: on
  // freelance analyses the responses stage never emits a row, so listing it
  // would leave a permanently-pending tail. Omitted, never faked.
  const defs = opts?.expectsResponses === false ? STAGE_DEFS.filter((d) => d.key !== "responses") : STAGE_DEFS
  const latestByPhase = new Map<string, string>()
  for (const row of rows) {
    if (typeof row.phase !== "string" || typeof row.status !== "string") continue
    latestByPhase.set(row.phase, row.status)
  }
  const started = (def: StageDef): boolean =>
    def.phases.some((p) => {
      const s = latestByPhase.get(p)
      return s === "start" || s === "success" || s === "failure"
    })
  const states = defs.map((def, i) => {
    let failed = false
    let succeeded = false
    for (const phase of def.phases) {
      const s = latestByPhase.get(phase)
      if (s === "success") succeeded = true
      else if (s === "failure" && def.fatalFailure) failed = true
    }
    if (failed) return "failed" as const
    if (succeeded) return "done" as const
    // Pipeline moved on: a later stage started means this one completed
    // (possibly degraded — still complete, never red).
    for (let j = i + 1; j < defs.length; j++) {
      if (started(defs[j]!)) return "done" as const
    }
    return (def.phases.some((p) => latestByPhase.get(p) === "start") ? "active" : "pending") as AnalysisStageState
  })
  // Collapse to a single active stage: the first non-done stage that started.
  let activeAssigned = false
  return defs.map((def, i) => {
    let state = states[i]!
    if (state === "active") {
      if (activeAssigned) state = "pending"
      else activeAssigned = true
    }
    return { key: def.key, label: def.label, state }
  })
}

/** True when the feed carries any signal at all (beyond all-pending). */
export function hasStageSignal(stages: AnalysisStage[]): boolean {
  return stages.some((s) => s.state !== "pending")
}
