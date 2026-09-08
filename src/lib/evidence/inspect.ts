// Source inspection (Phase 8).
//
// Resolves an Evidence reference against a snapshot of the source it came
// from and reports exactly what can be shown: EXACT (offsets verified
// against the same source text), APPROXIMATE (quote located, position not
// guaranteed), or UNAVAILABLE (nothing to open, or the source changed).
// Pure and side-effect free. Never upgrades approximate evidence, never
// downgrades verified exact evidence, and never treats a missing source as
// proof that the observation was false.

import type { Evidence } from "./schema"

export type InspectionStatus = "EXACT" | "APPROXIMATE" | "UNAVAILABLE"

export interface SourceDocument {
  // Stable handle for display (file name, "Pasted input", ...).
  label: string
  text: string
}

export interface SourceSnapshot {
  auditId: string
  documents: SourceDocument[]
}

export interface InspectionResult {
  status: InspectionStatus
  evidence: Evidence
  // The located quote as found in the source (whitespace-normalized match).
  locatedQuote: string | null
  // Which document held the match, when identified.
  documentLabel: string | null
  // Character offsets, present ONLY when an exact span was verified against
  // the displayed text. Otherwise absent, never guessed.
  startOffset: number | null
  endOffset: number | null
  // Where the quote was found in the displayed document, for highlighting.
  // Present for EXACT and APPROXIMATE results; this is a located match, not
  // a stored claim, and must never be presented as an exact span by itself.
  matchOffset: number | null
  // Honest human-readable explanation, safe to render directly.
  message: string
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase()
}

// Finds a quote inside a document with whitespace-insensitive matching and
// returns the character offset of the match, or -1. Matching is deliberately
// literal (no fuzzing): a paraphrased source must report unavailable rather
// than a confident-looking wrong highlight.
function locateQuote(documentText: string, quote: string): number {
  const haystack = normalize(documentText)
  const needle = normalize(quote)
  if (needle.length === 0) return -1
  // Map back to the original offset by scanning for the needle's first
  // significant token, then verifying the full normalized span.
  const firstToken = needle.split(" ").find((token) => token.length > 2)
  if (!firstToken) return -1
  let searchFrom = 0
  for (;;) {
    const candidate = haystack.indexOf(firstToken, searchFrom)
    if (candidate < 0) return -1
    // Verify the full quote follows (allowing only whitespace differences,
    // which normalization already collapsed).
    if (haystack.startsWith(needle, candidate)) {
      // Convert the normalized offset back to the raw document offset with a
      // normalized-to-raw position map. Normalization trims leading
      // whitespace, so mapping starts at the first non-whitespace character.
      const raw = documentText
      const map: number[] = []
      let inWhitespace = true
      let started = false
      for (let i = 0; i < raw.length; i += 1) {
        if (/\s/.test(raw[i])) {
          if (started && !inWhitespace) {
            inWhitespace = true
            map.push(i)
          }
          continue
        }
        started = true
        inWhitespace = false
        map.push(i)
      }
      return map[candidate] ?? -1
    }
    searchFrom = candidate + 1
  }
}

export function inspectEvidence(evidence: Evidence, snapshot: SourceSnapshot): InspectionResult {
  const base = { evidence }
  // Knowledge evidence points at a curated item, not at user content. Its
  // provenance is already displayed alongside answers; there is no document
  // position to open.
  if (evidence.sourceType === "knowledge") {
    return {
      ...base,
      status: "UNAVAILABLE",
      locatedQuote: null,
      documentLabel: null,
      startOffset: null,
      endOffset: null,
      matchOffset: null,
      message: "This observation references a curated knowledge source, shown with the answer. It has no document position to open.",
    }
  }
  if (!evidence.quote || snapshot.documents.length === 0) {
    return {
      ...base,
      status: "UNAVAILABLE",
      locatedQuote: null,
      documentLabel: null,
      startOffset: null,
      endOffset: null,
      matchOffset: null,
      message: snapshot.documents.length === 0
        ? "The original input for this analysis is no longer available, so the source cannot be opened."
        : "This observation has no quoted text to locate, so there is no position to open.",
    }
  }
  for (const document of snapshot.documents) {
    const offset = locateQuote(document.text, evidence.quote)
    if (offset < 0) continue
    // An exact claim is honored ONLY when stored offsets verify against the
    // same text being displayed. Anything else stays approximate.
    if (
      evidence.location.kind === "exact" &&
      evidence.location.startOffset !== undefined &&
      evidence.location.endOffset !== undefined &&
      document.text.slice(evidence.location.startOffset, evidence.location.endOffset).trim().length > 0 &&
      normalize(document.text.slice(evidence.location.startOffset, evidence.location.endOffset)) ===
        normalize(evidence.quote)
    ) {
      return {
        ...base,
        status: "EXACT",
        locatedQuote: evidence.quote,
        documentLabel: document.label,
        startOffset: evidence.location.startOffset,
        endOffset: evidence.location.endOffset,
        matchOffset: evidence.location.startOffset,
        message: "Exact source location, verified against the displayed document.",
      }
    }
    return {
      ...base,
      status: "APPROXIMATE",
      locatedQuote: evidence.quote,
      documentLabel: document.label,
      startOffset: null,
      endOffset: null,
      matchOffset: offset,
      message: "Approximate location: the quoted text was found in this document, but the precise position is not guaranteed.",
    }
  }
  return {
    ...base,
    status: "UNAVAILABLE",
    locatedQuote: null,
    documentLabel: null,
    startOffset: null,
    endOffset: null,
    matchOffset: null,
    message: "The quoted text was not found in the current source. The document may have changed since the analysis ran; the observation itself is unchanged.",
  }
}
