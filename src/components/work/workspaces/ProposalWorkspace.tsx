"use client"

import Link from "next/link"
import { Section } from "./Section"
import { DocVersionList } from "./DocVersionList"
import { creditsForDocumentType } from "@/lib/credits/pricing"
import type { DocVersion, WorkspaceData } from "./types"

function groupByType(versions: DocVersion[]): Array<[string, DocVersion[]]> {
  const map = new Map<string, DocVersion[]>()
  for (const v of versions) {
    const list = map.get(v.document_type) ?? []
    list.push(v)
    map.set(v.document_type, list)
  }
  return [...map.entries()]
}

// Proposal and SOW share one honest shape: actual generated versions with
// history, the source inputs behind them, and the generation path that
// exists for this deal type. Focus selects which family leads.
export function ProposalWorkspace({ data, focus, auditId, dealType, onGenerate }: {
  data: WorkspaceData
  focus: "proposal" | "sow"
  auditId?: string | null
  dealType?: string | null
  onGenerate?: () => void
}) {
  const focused = data.versions.filter((v) => v.document_type === focus)
  const others = data.versions.filter((v) => v.document_type !== focus)
  const title = focus === "proposal" ? "Proposal" : "Statement of work"
  const canGenerate = dealType === "freelance" && !!onGenerate
  return (
    <div>
      <Section
        title={title}
        hint={focused.length > 0 ? "Generated output with version history." : "No generated output yet for this deal."}
      >
        {focused.length > 0 ? (
          <DocVersionList versions={focused} />
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
            {canGenerate ? (
              <span>Nothing generated yet. Creating protection generates the {focus === "proposal" ? "proposal" : "SOW"} alongside the full package.</span>
            ) : (
              <span>Nothing generated yet. {focus === "proposal" ? "Proposals" : "SOWs"} generate from an analysis of this deal; run the analysis in the conversation first.</span>
            )}
          </div>
        )}
      </Section>
      {data.deliverables.length > 0 && (
        <Section title="Source scope" hint="Deliverables the output was built from.">
          <ul className="list-disc space-y-1 pl-5 font-serif text-sm leading-relaxed">
            {data.deliverables.slice(0, 10).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </Section>
      )}
      {data.missingInputs.length > 0 && (
        <Section title="Missing inputs" hint="Confirm these so the output stops guessing.">
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {data.missingInputs.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Section>
      )}
      {others.length > 0 && (
        <Section title="Other documents" hint="Elsewhere in this deal.">
          <div className="space-y-1">
            {groupByType(others).map(([type, list]) => (
              <p key={type} className="text-xs text-muted-foreground">
                <span className="font-medium capitalize text-foreground">{type.replaceAll("_", " ")}</span>
                {" "}· v{list.map((v) => v.version_number).join(", v")}
              </p>
            ))}
          </div>
        </Section>
      )}
      <Section title="Next actions">
        <div className="flex flex-wrap items-center gap-2">
          {canGenerate && (
            <button
              type="button"
              onClick={onGenerate}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Generate {focus === "proposal" ? "proposal" : "SOW"} ({creditsForDocumentType(focus)} credits)
            </button>
          )}
          {auditId && focused.length > 0 && (
            <Link href={`/document/${auditId}`} className="rounded-full border px-4 py-1.5 text-xs font-medium hover:bg-muted/60">
              Open full document
            </Link>
          )}
        </div>
      </Section>
    </div>
  )
}
