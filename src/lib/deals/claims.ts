import type { ClaimedStatus } from "@/lib/rules/result"

// Ask prompt assembly + claims-block parsing. Pure and client-safe in
// principle, but lives in lib (server-action modules may only export
// async functions).

export interface AskFinding {
  ruleKey: string
  status: string
  severity: string
  summary: string
  guidance: string | null
  evidenceQuote: string | null
}

export function buildAskPrompt(input: {  question: string
  dealType: string
  material: string
  findings: AskFinding[]
  history: Array<{ role: string; text: string }>
  standing?: string | null
}): { systemPrompt: string; userContent: string } {
  const findingLines = input.findings.map(
    (f) => `- [${f.ruleKey}] (${f.severity}) ${f.summary}${f.guidance ? ` Guidance: ${f.guidance}` : ""}${f.evidenceQuote ? ` Quote: “${f.evidenceQuote}”` : ""}`
  )
  const historyLines = input.history.map((t) => `${t.role === "user" ? "User" : "Dealenz"}: ${t.text}`)
  const systemPrompt = [
    "You answer questions about the user's own deal. Dealenz works for the user, never for closing the deal.",
    "Rules you must obey:",
    "1. Answer ONLY from the deal material and findings below. Never invent terms, parties, dates, or law.",
    "2. Quote findings by rule key when you rely on them. Every material claim traces to a finding or a quote.",
    "3. Never contradict a deterministic finding: a FAIL stays a FAIL. If the user pushes toward an unsafe reading, say so plainly with the finding as reason.",
    "4. When evidence runs out, ask ONE targeted question instead of guessing — then stop. Do not answer around the gap.",
    "5. Plain complete sentences, concise by default, no sycophancy, no commercial bias.",
    "6. End your response with exactly one machine line listing every verdict you asserted, or [[CLAIMS none]] if you asserted none.",
    'Format: [[CLAIMS ruleKey1:FAIL, ruleKey2:PASS]] using statuses PASS, FAIL, or UNKNOWN only.',
  ].join("\n")
  const userContent = [
    `Deal type: ${input.dealType}`,
    "",
    ...(input.standing ? ["Standing positions (the user's workspace playbook — apply to this deal, quote when used):", input.standing, ""] : []),
    "FINDINGS (deterministic, authoritative):",
    findingLines.length > 0 ? findingLines.join("\n") : "(no findings recorded)",
    "",
    "DEAL MATERIAL (excerpt):",
    input.material,
    ...(historyLines.length > 0 ? ["", "RECENT TURNS:", ...historyLines] : []),
    "",
    `QUESTION: ${input.question}`,
  ].join("\n")
  return { systemPrompt, userContent }
}

export function parseClaimsBlock(text: string): { claims: ClaimedStatus[]; clean: string } {
  const match = text.match(/\[\[CLAIMS\s+([^\]]*)\]\]\s*$/)
  if (!match) return { claims: [], clean: text.trim() }
  const raw = (match[1] ?? "").trim().toLowerCase()
  if (raw === "" || raw === "none") return { claims: [], clean: text.slice(0, match.index).trim() }
  const claims: ClaimedStatus[] = []
  for (const part of raw.split(",")) {
    const [key, status] = part.split(":").map((s) => s.trim())
    if (!key || (status !== "pass" && status !== "fail" && status !== "unknown")) continue
    claims.push({ ruleKey: key, assertedStatus: status.toUpperCase() as "PASS" | "FAIL" | "UNKNOWN" })
  }
  return { claims, clean: text.slice(0, match.index).trim() }
}
