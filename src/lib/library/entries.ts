// Clause-library entry validation — pure helpers for the Library section.
//
// Versioning rule (industry standard): edits never rewrite history. An edit
// inserts a new row at version+1 and marks the prior row superseded; a
// deprecation retires the latest row without deleting it. These helpers
// validate inputs and derive keys so the server actions stay thin.

export const MAX_LIBRARY_TITLE = 120
export const MAX_LIBRARY_BODY = 8000
export const MAX_LIBRARY_CHANGE_NOTE = 280
export const MAX_LIBRARY_CATEGORY = 40

export type LibraryClauseStatus = "active" | "deprecated" | "superseded"

// Three-tier positions (industry standard): the language you open with, the
// fallback you can live with, and the walk-away line. A line without an
// explicit walk-away concedes under deal pressure — the UI says so.
export type LibraryClauseVariant = "preferred" | "fallback" | "walkaway"

export const LIBRARY_VARIANTS: readonly LibraryClauseVariant[] = ["preferred", "fallback", "walkaway"]

export function isLibraryVariant(raw: unknown): raw is LibraryClauseVariant {
  return raw === "preferred" || raw === "fallback" || raw === "walkaway"
}

export type LibraryLanguage = "en" | "fr" | "de"

export function isLibraryLanguage(raw: unknown): raw is LibraryLanguage {
  return raw === "en" || raw === "fr" || raw === "de"
}

export interface LibraryClauseRow {
  id: string
  key: string
  variant: LibraryClauseVariant
  language: LibraryLanguage
  version: number
  title: string
  body: string
  category: string
  dealTypes: string[]
  status: LibraryClauseStatus
  changeNote: string
  templateId: string | null
  templateVersion: number | null
  useCount: number
  lastUsedAt: string | null
  createdAt: string
}

/** Stable grouping key for a snapshot of a code-owned standard clause. */
export function standardClauseKey(templateId: string): string {
  return `std:${templateId.trim().toLowerCase()}`
}

/** Stable grouping key for user-authored language. */
export function customClauseKey(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `custom:${slug || "clause"}`
}

export function normalizeLibraryTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const title = raw.trim().slice(0, MAX_LIBRARY_TITLE)
  return title.length > 0 ? title : null
}

export function normalizeLibraryBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const body = raw.trim().slice(0, MAX_LIBRARY_BODY)
  return body.length > 0 ? body : null
}

export function normalizeLibraryCategory(raw: unknown): string {
  if (typeof raw !== "string") return "general"
  const category = raw.trim().toLowerCase().slice(0, MAX_LIBRARY_CATEGORY)
  return category.length > 0 ? category : "general"
}

/**
 * Latest usable row per key+variant+language: highest version that is not
 * superseded. Each language carries its own history — preferred-FR evolves
 * independently of preferred-EN.
 */
export function latestUsableEntries(rows: LibraryClauseRow[]): LibraryClauseRow[] {
  const bySlot = new Map<string, LibraryClauseRow>()
  for (const row of rows) {
    if (row.status === "superseded") continue
    const slot = `${row.key}:${row.variant}:${row.language}`
    const cur = bySlot.get(slot)
    if (!cur || row.version > cur.version) bySlot.set(slot, row)
  }
  const order: Record<LibraryClauseVariant, number> = { preferred: 0, fallback: 1, walkaway: 2 }
  return [...bySlot.values()].sort(
    (a, b) => a.title.localeCompare(b.title) || a.language.localeCompare(b.language) || order[a.variant] - order[b.variant]
  )
}

/** Variants a line is missing in a language — a line without walkaway concedes under pressure. */
export function missingVariants(rows: LibraryClauseRow[], key: string, language: LibraryLanguage): LibraryClauseVariant[] {
  const have = new Set(
    rows.filter((r) => r.key === key && r.language === language && r.status !== "superseded").map((r) => r.variant)
  )
  return LIBRARY_VARIANTS.filter((v) => !have.has(v))
}

/** True when the row may accept a new version (active or deprecated heads). */
export function canVersion(status: LibraryClauseStatus): boolean {
  return status === "active" || status === "deprecated"
}

export type ClauseUserState = "accepted" | "edited" | "dismissed"

export function isClauseUserState(raw: unknown): raw is ClauseUserState {
  return raw === "accepted" || raw === "edited" || raw === "dismissed"
}
