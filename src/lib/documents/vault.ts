import type { GeneratedDocument } from "@/lib/generate"

export interface VaultFile {
  name: string
  size: number
  type: string
  path: string
}

export interface VaultInput {
  rawInput: string | null
  files: VaultFile[]
  documents: GeneratedDocument[]
  hasVersions: boolean
  hasRiskSnapshot: boolean
  hasHandoff: boolean
}

export type VaultSection = "source" | "drafts" | "risk" | "handoff"

export interface VaultListing {
  sections: VaultSection[]
  draftCount: number
  fileCount: number
  hasSourceText: boolean
}

export function getAllDocumentsForAudit(input: VaultInput): VaultListing {
  const hasSourceText = Boolean(input.rawInput && input.rawInput.trim().length > 0)
  const sections: VaultSection[] = []
  if (hasSourceText || input.files.length > 0) sections.push("source")
  if (input.documents.length > 0 || input.hasVersions) sections.push("drafts")
  if (input.hasRiskSnapshot) sections.push("risk")
  if (input.hasHandoff) sections.push("handoff")
  return {
    sections,
    draftCount: input.documents.length,
    fileCount: input.files.length,
    hasSourceText,
  }
}
