# Phase C Deliberation — Batch + Portals

Status: PROPOSED. Nothing below changes `product.md` / `architecture.md`
until approved. Each decision records options, the market evidence, and the
recommendation. Approval amends the docs first, then code follows.

## D1. Batch cost gate (estimate → approval → capped fan-out)

- Options: (a) priced manifest gate; (b) unpriced queue like vendors.
- Evidence: no vendor prices compute per file (market-research §1.2); Dealenz
  credits doctrine requires estimate-before-spend (architecture.md).
- Recommendation: **(a)**. The gate is proprietary necessity, not industry
  imitation. Per-file credit ceiling + fixed concurrency + failure isolation
  are the engineering answer to it.

## D2. Manifest-first intake

- Options: (a) manifest with type mix + estimate, user approves; (b) direct
  drop-and-run.
- Evidence: formal intake channel + upfront capture is convergent
  (PandaDoc; 2025 Guide).
- Recommendation: **(a)**. A 500-file folder must never surprise-bill or
  silently misroute.

## D3. Batch review routing

- Options: (a) value/risk-threshold routing of flagged files to humans;
  (b) fully automatic rollup.
- Evidence: threshold-based approval routing is convergent (PandaDoc;
  Malbek). Dealenz already routes consequential acts through Approvals.
- Recommendation: **(a)** — files surfacing critical findings pause at the
  Approvals queue; clean files roll up automatically.

## D4. Portal shape: three audience doors vs one guest door

- Options: (a) distinct employee / supplier / customer doors; (b) one
  token-scoped guest door with per-share audience typing.
- Evidence: vendors scope by *contract*, not by door count — one portal with
  row-level scoping + tiered roles is the convergent shape (Sirion; D365;
  PeopleSoft). Separate doors are branding, not security.
- Recommendation: **(b)** — one external surface, audience typed per grant
  (`employee` / `supplier` / `customer`), scoped to its contracts. Cheaper to
  govern, identical security posture. Product copy may still name the three
  audiences.

## D5. External redlines: staged reconciliation + primary owner

- Options: (a) PeopleSoft shape — one primary external owner uploads back,
  edits stage outside version control, internal admin accepts;
  (b) live co-editing.
- Evidence: staged reconciliation is the audited pattern (PeopleSoft);
  native co-editing (PandaDoc/Sirion) assumes a shared platform, which
  token-guests don't have.
- Recommendation: **(a)**. It also fits `document_versions` never-mutate
  history: staged files become new versions only on acceptance.

## D6. External roles

- Options: (a) reader / commenter / participant (current trajectory) +
  vendor-admin; (b) full internal role mirror.
- Evidence: tiered external roles with a vendor-side admin are convergent
  (Sirion; D365). Externals never hold internal roles.
- Recommendation: **(a)**. Vendor-admin manages their own users only;
  invites still require an internal owner.

## D7. Access lifecycle

- Recommendation: **time-bound grants, auto-revoked** on expiry/deal close
  (convergent — Sirion; entry already exists as share expiry). No decision
  needed beyond extending the pattern.

## Deferred (explicit non-goals for Phase C)

- **Self-registration**: needs the identity story (SSO/SCIM open decisions
  10–11 in architecture.md) first. Invitation-only stays.
- **View-only / watermarking / DLP**: enterprise tier; token links already
  carry no-download semantics via scoped pages.
- **Traffic-split prompt A/B**: no production serving path exists; same-input
  comparison (shipped in Phase B) is the applicable practice.
- **Legacy bulk migration tooling** (dedupe, OCR repair queues): out of
  scope until a paying portfolio-migration customer exists.

## Doc amendments on approval

1. `product.md` Folder Batch: manifest → estimate approval → capped fan-out
   → threshold-routed review → rollup (replaces current paragraph).
2. `product.md` Teams, Groups, Guests: one guest surface, audience-typed
   grants; primary-owner upload-back with staged reconciliation.
3. `architecture.md` Batch Workers: runs on the work core (plan + approval
   + execute), no parallel batch tables — see D8.
4. `architecture.md` Teams & Permissions: guest grant typing
   (`employee` / `supplier` / `customer`), vendor-admin scope.

## Addendum (implementation deliberation, approved with the above)

### D8. Batch execution reuses the work core — no `batch_jobs` tables

- Options: (a) new `batch_jobs` / `batch_items` tables as planned;
  (b) manifest as a computed preview + execution as a work plan
  (N analysis steps, existing approval gate, existing executor).
- Evidence: the work core already implements every deliberated requirement
  (estimate in steps, `requestPlanApproval`, fixed-concurrency executor,
  per-step credit caps, idempotent steps). Parallel tables would duplicate
  the approval/audit trail.
- Decision: **(b)**. The `batch_jobs` plan in architecture.md is superseded;
  the manifest is computed, the plan is the record, the rollup reads steps +
  per-deal outcomes. Amended in architecture.md accordingly.

### D9. Guest access follows the signing token-RPC precedent

- Options: (a) session-less token grants verified in SECURITY DEFINER RPCs
  (the `/sign/[token]` shape); (b) guest accounts with passwords.
- Evidence: token-RPC is the audited in-repo pattern for no-account
  externals; self-registration is deferred (D-deferred: identity story).
- Decision: **(a)**. `guest_grants` (deal, audience, scope, primary-owner
  flag, email, token, expiry) + `staged_uploads` (owner-accepted into
  versions). Invitation-only; owner creates every grant.

### D10. Guest v1 scopes: reader + uploader only

- Options: (a) full scope mirror (commenter/asker); (b) reader +
  primary-owner upload-back.
- Evidence: commenting/asking ride member pipelines (threads, credit
  reservation); rebuilding them for token guests doubles the surface.
- Decision: **(b)**. Guests read their deal's versions/findings and (one
  primary owner per deal) upload redlines back staged. Commenting stays a
  member path until a guest identity story exists.
