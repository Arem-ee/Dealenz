"use client"

import { useState } from "react"
import { Section } from "./Section"
import { DocVersionList } from "./DocVersionList"
import type { WorkspaceData } from "./types"

// Protection as work: the checklist is the plan, generated documents are
// the output. Toggling goes through the existing server action; failures
// surface and the toggle reverts.
export function ProtectionWorkspace({ data, dealType, onGenerate }: {
  data: WorkspaceData
  dealType?: string | null
  onGenerate?: () => void
}) {
  const [states, setStates] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const protectionDocs = data.versions.filter((v) =>
    ["contract", "checklist", "protection_clause"].includes(v.document_type) || v.document_type.endsWith("-agreement") || v.document_type.includes("schedule") || v.document_type.includes("terms")
  )
  const canGenerate = dealType === "freelance" && !!onGenerate

  const toggle = async (id: string, current: string | null) => {
    const next = current === "completed" ? "in_scope" : "completed"
    setStates((s) => ({ ...s, [id]: next }))
    setError(null)
    try {
      const { updateChecklistItem } = await import("@/app/audit/[id]/actions")
      await updateChecklistItem(id, { status: next })
    } catch (e) {
      setStates((s) => ({ ...s, [id]: current ?? "in_scope" }))
      setError(e instanceof Error ? e.message : "Could not update that item.")
    }
  }

  return (
    <div>
      <Section
        title="Checklist"
        hint={data.checklist.length > 0 ? "Deliverables protection, tracked to done." : "No checklist generated for this deal yet."}
      >
        {data.checklist.length === 0 ? (
          <p className="text-xs text-muted-foreground">The checklist is created when protection documents generate.</p>
        ) : (
          <div className="space-y-1.5">
            {data.checklist.map((item) => {
              const status = states[item.id] ?? item.status ?? "in_scope"
              const done = status === "completed"
              return (
                <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => void toggle(item.id, status)}
                    className="mt-0.5"
                    aria-label={item.label}
                  />
                  <span className={done ? "text-xs text-muted-foreground line-through" : "text-xs"}>{item.label}</span>
                </label>
              )
            })}
          </div>
        )}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </Section>
      <Section title="Generated protection" hint="What exists, with history.">
        {protectionDocs.length > 0 ? (
          <DocVersionList versions={protectionDocs} />
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
            {canGenerate ? "Nothing generated yet. Create the protection package to produce it." : "Nothing generated yet — document generation covers freelance deals today."}
          </div>
        )}
      </Section>
      {canGenerate && (
        <Section title="Next actions">
          <button
            type="button"
            onClick={onGenerate}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Generate protection package
          </button>
        </Section>
      )}
    </div>
  )
}
