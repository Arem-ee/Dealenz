// Deal intake helpers — pure, client-safe. Title derivation, deal-type
// proposal from material, staged-file validation, message-size handling.
// Server re-validates everything; these exist so the UI fails fast with
// clear reasons instead of spending an upload round-trip.

export const INTAKE_DEAL_TYPES = [
  "founder",
  "partnership",
  "purchase_sale",
  "lease",
  "employment",
  "freelance",
  "generic",
] as const

export type IntakeDealType = (typeof INTAKE_DEAL_TYPES)[number]

export function isIntakeDealType(v: unknown): v is IntakeDealType {
  return typeof v === "string" && (INTAKE_DEAL_TYPES as readonly string[]).includes(v)
}

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const

export const ACCEPT_STRING = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"

export const MAX_INTAKE_FILE_SIZE = 10 * 1024 * 1024
export const MAX_INTAKE_FILES = 10
export const MAX_MESSAGE_CHARS = 8000

// Minimum extracted characters for a file to count as readable. Below this
// the file is flagged unreadable — it must never become an empty deal.
export const MIN_READABLE_CHARS = 50

export function deriveTitle(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim()
  if (!oneLine) return "Untitled deal"
  return oneLine.length > 80 ? `${oneLine.slice(0, 77).trimEnd()}…` : oneLine
}

// Transparent keyword proposal, not a model judgment. The thread banner
// shows it with one-tap correction; generic is the honest default.
export function proposeDealType(text: string): IntakeDealType {
  const t = text.toLowerCase()
  if (/\bvesting\b|\bcap table\b|\bco-?founder\b|\bfounder\b|\bequity split\b|\bconvertible note\b/.test(t)) return "founder"
  if (/\bpartnership\b|\bpartner\b|\bprofit share\b|\bdrawings\b/.test(t)) return "partnership"
  if (/\blease\b|\blandlord\b|\btenant\b|\brent\b|\bpremises\b/.test(t)) return "lease"
  if (/\bemployment\b|\bemployer\b|\bsalary\b|\bnon-?compete\b|\bseverance\b/.test(t)) return "employment"
  if (/\bpurchase\b|\bsale of\b|\bbuyer\b|\bseller\b|\basset sale\b/.test(t)) return "purchase_sale"
  if (/\bfreelance\b|\bclient\b|\bscope of work\b|\bdeliverable\b|\binvoice\b/.test(t)) return "freelance"
  return "generic"
}

export type StagedFileProblem =
  | { kind: "type"; message: string }
  | { kind: "size"; message: string }
  | { kind: "empty"; message: string }
  | { kind: "count"; message: string }

export function validateStagedFile(
  file: { name: string; size: number; type: string },
  alreadyStaged: number
): StagedFileProblem | null {
  if (alreadyStaged >= MAX_INTAKE_FILES) {
    return { kind: "count", message: `A deal holds at most ${MAX_INTAKE_FILES} files — remove one first.` }
  }
  if (file.size <= 0) return { kind: "empty", message: `"${file.name}" is empty.` }
  if (file.size > MAX_INTAKE_FILE_SIZE) {
    return { kind: "size", message: `"${file.name}" exceeds the 10MB limit.` }
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  const extOk = ext === "pdf" || ext === "docx" || ext === "txt"
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type) && !extOk) {
    return { kind: "type", message: `"${file.name}" is not a PDF, Word, or text file.` }
  }
  return null
}

// Message rows cap at 8000 chars; the full text always lands in raw_input.
// Truncation is marked, never silent.
export function fitMessage(text: string): { content: string; truncated: boolean } {
  if (text.length <= MAX_MESSAGE_CHARS) return { content: text, truncated: false }
  return { content: `${text.slice(0, MAX_MESSAGE_CHARS - 20).trimEnd()}…(truncated)`, truncated: true }
}

export function sanitizeStorageName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file"
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").slice(-120)
  return cleaned.length > 0 ? cleaned : "file"
}
