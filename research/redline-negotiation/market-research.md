# Redline Editor + Negotiation Loop Market Research

Date: 2026-10-08. Method: vendor/analyst documentation (full text fetched).
Nothing here is built yet; see `deliberation.md`.

## 1. Two architectures for redlining (pick one)

- **Browser-native single lineage (Juro).** Draft, negotiate, and sign in one
  shared rich-text editor: simultaneous editing, threaded comments, zero
  version-reconciliation work because there is only ever one current
  document. Kills the "which version is current" category entirely. Costs:
  no Word; counterparty works in your environment or not at all.
- **Word-integrated reconcile (Icertis, Conga, SpotDraft, Volody).** Check
  out → redline in Word → check in as `*_vN_Redlines`; clean/final saved
  separately; compare tracks version-to-version changes; staged external
  files reconcile into version control by an internal admin (Conga,
  PeopleSoft pattern from Phase C research). Costs: permanent
  reconciliation work (measured at ~15% of negotiation effort), Word
  dependency.
- Dealenz has no Word anywhere and already stages third-party paper outside
  version control (Phase C). The browser-native model fits; staged uploads
  remain the third-party-paper door.

## 2. The round model (Bind multi-round; Inferensys NegotiationRound)

- Negotiation runs in **rounds**, each a structured object: round number,
  proposing party, base version → proposed version, per-clause dispositions,
  timestamp. Multi-round context retention (what round 1 decided still
  binds round 3) is what separates negotiation from one-shot review.
- **Four outcomes per counterparty change** (Bind), evaluated against the
  playbook: (1) within pre-approved variation → accept silently, log it;
  (2) triggers a fallback ladder → propose counter-language from the first
  acceptable rung; (3) crosses a hard limit → escalate with rationale;
  (4) novel, uncovered → route to legal with a diff summary. Only (3) and
  (4) need humans; (1)–(2) settle routinely with per-clause reasoning
  attached ("proposed Fallback 2 because round 1 already spent Fallback 1").
- Every round assembles the next document: accepts + fallback insertions +
  flagged hard-limits left for approvers + routed novelties. Output is
  counter-language ready to send, never just a report.

## 3. Enforcement tiers (Sirion; Volody; Icertis NegotiateAI)

- Tier 1: standard fallbacks auto-apply. Tier 2: mid-level review.
  Tier 3: executive sign-off. Deviation scoring flags off-playbook edits;
  concession-history logs track offered/accepted terms per party against
  risk thresholds; counterparty-specific precedent (last five accepted
  deviations for this tier) informs trade-offs.

## 4. Clause-level history (Icertis)

- The library tracks per clause: original text, current text, approved
  changes across rounds. Post-negotiation analysis answers which clauses
  get pushed back most, which fallbacks counterparties accept, where the
  playbook needs adjustment — the direct feed for acceptance-measured
  re-ranking (pairing D7, deferred to analytics).

## 5. Dual comments (Volody)

- Internal strategy channel vs counterparty-visible channel, enforced so
  guests can never see internal discussion. With Dealenz guests as
  readers/uploaders, comment visibility by principal is a hard requirement,
  not a nicety.

## 6. Handoff chain (Bind; PandaDoc; Conga)

- Draft → internal review → counterparty workspace → agreed → e-signature
  with no re-upload between stages. Every manual handoff is where delay,
  error, and version confusion enter.

## 7. Rollout discipline (Inferensys; Bind)

- Pilot one high-volume contract type; phased exit criteria per stage
  (adoption, override rate) before expanding; playbook configuration (not
  software deployment) is the larger investment.

## 8. Dealenz's current position

- Owns: immutable versions, line diffs, compare tab, staged upload-back
  with accept-into-version, paired ladders with when/why, escalation
  requests, reader/uploader guests, signing ceremony, negotiation prompt
  engine (`lib/ai/negotiation.ts`).
- Missing: the round as a first-class object; per-change four-outcome
  evaluation wired to ladders; an editor surface for proposing/accepting
  per tracked clause; dual comments; clause-level concession log;
  agreed → signing handoff without re-upload.
