# Negotiation Gaps Deliberation

Status: PROPOSED. Nothing below changes `product.md` / `architecture.md`
until approved. Approval amends the docs first, then code follows.

## D1. Record anchors at generation time (own versions)

- Options: (a) assembler emits clause spans (clause id, start/end offsets,
  template version) stored per version at write time; (b) post-hoc
  extraction on own versions too.
- Evidence: own versions are assembled from known templates — recording is
  exact and free; post-hoc extraction on text you generated yourself is
  pure error budget (Respan: segmentation is the #1 subtle-bug source).
- Recommendation: **(a)**. New `version_clause_spans` (version → clause →
  offsets + template version). Rounds read current language from spans,
  never from pasted attestations.

## D2. Locate-with-verification (third-party text only)

- Options: (a) verbatim locate → EXACT; Jaccard ≥ 0.5 → APPROXIMATE with
  score; else UNAVAILABLE + human review; ungrounded spans dropped;
  (b) fuzzy matching everywhere.
- Evidence: CUAD Jaccard ≥ 0.5; clauselens drop-ungrounded backbone;
  Respan failed-citations-surface rule; Dealenz evidence doctrine already
  speaks EXACT/APPROXIMATE/UNAVAILABLE.
- Recommendation: **(a)**. Applies to staged redlines and pasted material
  only. Owner-attested inputs remain as the explicit fallback when
  location fails — attestation labeled as attestation, never as located.

## D3. Guest posting on the external channel

- Options: (a) `commenter` scope on guest grants (alongside reader/
  uploader); guests post external-only, forced server-side; internal
  stays structurally unreachable; (b) owner-only posting forever.
- Evidence: unanimous market shape (Juro/DocJuris/CounselLink/Apryse);
  per-participant toggles; asymmetric visibility precedent.
- Recommendation: **(a)**. Scope-gated at grant creation, channel forced
  in the RPC (a commenter grant cannot address internal, even maliciously),
  rate-limited like uploads. Owner keeps delete/revoke; unresolved
  external threads block round acceptance (Apryse rule, D4).

## D4. Resolve-before-agreed

- Options: (a) accepting a round requires zero open external threads
  (or explicit per-thread resolution); (b) advisory only.
- Evidence: Apryse blocks signing on unresolved items; LexisNexis
  requires both-side accept.
- Recommendation: **(a)** for external threads (counterparty-visible
  promises must close); internal threads stay advisory.

## D5. Accept/reject handshake stays staged

- Recommendation: **no change**. Staged accept-into-version already is the
  handshake for redlines; comments resolve in place. No new semantics.

## Doc amendments on approval

1. `product.md` negotiation: spans recorded at generation, located with
   verification on third-party text; guests comment externally by grant.
2. `architecture.md` evidence/pipeline: anchor recording at assembly;
   locate thresholds (verbatim EXACT, Jaccard ≥ 0.5 APPROXIMATE).
