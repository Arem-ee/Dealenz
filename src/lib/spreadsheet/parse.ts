// Transient spreadsheet parsing — CSV only, no CRM table, server-side.
// Input is raw text (from uploaded .csv or .txt). Output is validated rows with stable identity.

export type RowState = "valid" | "invalid" | "needs_input" | "ready" | "generated" | "sent" | "failed"

export interface ParsedRow {
  rowId: string // stable server-derived: plan_id + plan_version + row_index + content_hash
  index: number
  raw: Record<string, string>
  email: string | null
  name: string | null
  company: string | null
  personalization: Record<string, string>
  state: RowState
  reason?: string
  contentHash: string
}

function hashString(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, "0")
}

function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"' && (i === 0 || line[i - 1] !== "\\")) {
      inQuote = !inQuote
      continue
    }
    if (c === "," && !inQuote) {
      out.push(cur.trim())
      cur = ""
      continue
    }
    cur += c
  }
  out.push(cur.trim())
  return out.map((s) => s.replace(/^"|"$/g, "").trim())
}

export function parseSpreadsheetCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    const rec: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) rec[headers[j]] = cols[j] ?? ""
    rows.push(rec)
  }
  return { headers, rows }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRows(
  rows: Record<string, string>[],
  requiredFields: string[] = ["email"],
  planId: string = "plan",
  planVersion: number = 1
): ParsedRow[] {
  const seen = new Set<string>()
  return rows.map((raw, index) => {
    const emailRaw = (raw["email"] ?? raw["recipient"] ?? raw["e-mail"] ?? "").trim()
    const email = emailRaw || null
    const name = (raw["name"] ?? raw["recipient_name"] ?? raw["full_name"] ?? "").trim() || null
    const company = (raw["company"] ?? raw["company_name"] ?? raw["organization"] ?? "").trim() || null
    const contentHash = hashString(JSON.stringify(raw))
    const rowId = `${planId}:v${planVersion}:r${index}:${contentHash}`

    let state: RowState = "valid"
    let reason: string | undefined

    if (!email) {
      state = "invalid"
      reason = "missing recipient"
    } else if (!EMAIL_RE.test(email)) {
      state = "invalid"
      reason = "invalid email"
    } else if (seen.has(email.toLowerCase())) {
      state = "invalid"
      reason = "duplicate row"
    } else {
      for (const f of requiredFields) {
        if (f === "email") continue
        const v = (raw[f] ?? "").trim()
        if (!v) {
          state = "needs_input"
          reason = `missing ${f}`
          break
        }
      }
    }
    if (email) seen.add(email.toLowerCase())

    // If row needs personalization data for protection (e.g., deal terms) and it's missing, mark needs_input
    const personalization: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (k !== "email" && k !== "e-mail" && k !== "recipient" && v.trim()) personalization[k] = v.trim()
    }

    if (state === "valid" && Object.keys(personalization).length === 0) {
      // No personalization data, but still valid for generic proposal (will use deal context)
    }

    return { rowId, index, raw, email, name, company, personalization, state, reason, contentHash }
  })
}

export function summarizeRows(rows: ParsedRow[]): { total: number; valid: number; invalid: number; needsInput: number } {
  return {
    total: rows.length,
    valid: rows.filter((r) => r.state === "valid").length,
    invalid: rows.filter((r) => r.state === "invalid").length,
    needsInput: rows.filter((r) => r.state === "needs_input").length,
  }
}
