# Negotiation Gaps Market Research — Span Anchoring + Guest Commenting

Date: 2026-10-08. Method: vendor docs, agent guides, OSS implementations
(full text fetched). Nothing here is built yet; see `deliberation.md`.

## 1. Clause span anchoring (replacing owner-attested inputs)

### The standard pipeline (Respan agent guide; Ertas; contract-ai-core)
1. **Format-aware parsing** — never flatten to plaintext before segmenting;
   headings, lists, and numbering are the structural cues.
2. **Heuristic segmentation by structural markers** — numbered headers,
   bold captions, all-caps titles get ~80% of boundaries correctly.
3. **LLM refinement for hard cases** — nested clauses, embedded
   definitions, continuations spanning sections.
4. **Per-clause analysis with citation grounding** — every suggestion cites
   a validated character offset; failed citations flag for human review,
   never silently dropped.

### Grounding, not trust (clauselens; CUAD)
- The model **quotes verbatim, then the quote is located in the source**;
  ungrounded quotes are **dropped, never trusted**. CUAD scores span match
  at Jaccard ≥ 0.5; clauselens accepts char-IoU ≥ 0.3 or verbatim, and
  reports both lenient and strict scores side by side.
- Absence is scored: correctly citing nothing when the clause is absent
  (0.83 in their eval) is half the value.
- Position-aware risks carry **character offsets + nearest section
  header**; click-to-jump with flash highlight (clause-ai).

### Dealenz's structural advantage (no vendor has this)
- Dealenz versions are **assembly-generated markdown with known clause
  templates**: at generation time the assembler knows exactly which
  character ranges came from which clause. Anchors can be **recorded
  deterministically at write time** — zero AI guessing, zero Jaccard
  thresholds — for every generated version. Post-hoc extraction (the
  market's entire apparatus above) is only needed for third-party text
  (counterparty redlines, pasted material), where locate-with-verification
  applies: verbatim locate → EXACT; Jaccard ≥ 0.5 locate → APPROXIMATE
  with score; else UNAVAILABLE + human review. This slots directly into
  the existing evidence doctrine (EXACT/APPROXIMATE/UNAVAILABLE).

## 2. Guest commenting (replacing owner-only posting)

### Unanimous market shape
- **Internal vs external channels** (Juro tabs; DocJuris; CounselLink
  discussions): internal never visible across the table, in either
  direction. External comments/redlines are visible even to guests
  without accounts (Juro).
- **Per-participant permission toggles** (Juro: Comment/Suggest checkboxes
  per member; Apryse: view/suggest/edit per participant; LexisNexis:
  Lead vs Reviewer): commenting and suggesting are separately grantable,
  revocable per document.
- **Asymmetric visibility exists in the wild**: a Reviewer's posts inside
  external discussions stay internal-only (CounselLink) — visibility is
  a property of the author, not just the channel.
- **Accept/reject handshake**: both sides must accept a text change; the
  other party's change requires your explicit accept (LexisNexis).
- **Unresolved items block signature** (Apryse): open comments/suggestions
  must resolve before the signing stage starts.

### Dealenz mapping
- Channels already exist with the right read boundary (portal RPC serves
  external only). Missing: guest **posting** to the external channel, and
  per-grant comment/suggest toggles on top of the reader/uploader scopes.
- The staged-accept flow already IS the accept/reject handshake for
  redlines; comments need the same resolve-or-block treatment before an
  agreed round (Apryse rule).
