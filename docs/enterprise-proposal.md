# Dealenz Enterprise Proposal: business contract review and analysis platform

Audited 2026-09-29 against the post-Batch-2 tree. External bar: ERCOT 2026 CLM RFP,
Formfy/Juro/Opstream buyer guides, LegalClarity requirements writing, Jinba/Velt/Intellicontract
enterprise AI-review positioning.

## Where Dealenz already clears the enterprise bar

- **Deterministic + evidence-backed review engine.** 7 deal-type rule packs, EXACT/APPROXIMATE
  evidence with source inspection, AI-explains-but-never-overrides. This is the rarest
  enterprise asset: competitors sell AI summaries; Dealenz sells provable findings.
- **Full lifecycle in one system:** intake → analysis → protection/drafting → redraft
  versioning → owner-first multi-party signing with tamper seal → obligation/renewal
  monitoring with email alerts. Most CLMs integrate DocuSign; owning the loop is a
  differentiator if the audit trail is litigation-grade.
- **Trust primitives enterprises ask for:** immutable version history (locked/superseded,
  content hashes), idempotent money/credit paths, RLS on every table, least-privilege
  SECURITY DEFINER RPCs, no anonymous AI surface, client-side PII masking before
  transmission, per-user data export + full account erasure (`delete_own_account`).
- **Operational habits:** 220+ test files, migration-order guards, honesty tests that
  read marketing copy, forward-only migrations.

## Gaps that block enterprise deals (ordered by how fast they kill a sale)

1. **Identity: no SSO/SAML, no SCIM, no MFA.** Supabase email/password + Google OAuth only;
   zero MFA references in code. Every enterprise RFP in the research lists SAML SSO + MFA
   as Must Have and SCIM as expected. Without these, IT blocks the purchase regardless of
   legal's enthusiasm.
2. **No teams, roles, or shared matters.** All data is `auth.uid()`-scoped to one human.
   No organizations, no RBAC (admin/contributor/viewer), no shared deal rooms, no
   delegation. The only cross-user surface is the lawyer-review flow. Enterprise buys for
   legal + procurement + finance together; single-player mode fails the buying committee.
3. **Audit trail exists but is not litigation-grade or self-serve.** `activity_events` +
   `system_logs` + `signing_events` record actions, but there is no immutable,
   tamper-evident export, no admin audit-log UI, no 7-year retention story, no
   e-discovery format. ERCOT-class RFPs demand immutable per-action logs with user,
   timestamp, IP, and export.
4. **Compliance posture is claimed, not evidenced.** The current landing claims SOC 2
   Type II certification, EU hosting, and AES-256. SOC 2 Type II cannot be verified from
   the repo and must be attested by the founder before it appears in marketing; an
   enterprise buyer will ask for the report within the first call. No DPA template, no
   subprocessor list, no BAA path, no published RTO/RPO or uptime SLA, no status page.
5. **No redlining loop.** Review exists (lawyer comments, propose-change, re-check diffs
   of findings), but there is no clause-anchored suggest/accept/reject redline on the
   document itself. Velt's framing holds: in legal work the redline is the product, and
   counterparty negotiation still round-trips through email/Word.
6. **No approval chains.** Work approvals gate credit spend, not legal decisions. No
   value-threshold routing (e.g. >$25k needs counsel + finance), no quorum, no
   escalation. Jinba-style policy routing is the enterprise expectation.
7. **No integrations and no API.** Gmail is the only business-system connection. No
   Salesforce/HubSpot, no SharePoint/Drive sync, no Slack/Teams notifications, no public
   API or webhooks for customer workflows. Formfy's guide is blunt: vendors gating API
   access lose enterprise deals.
8. **E-signature is self-built.** Drawn/typed images + tamper seal + certificate is fine
   for low-value agreements, but enterprise counsel will ask about eIDAS/ESIGN/UETA
   positioning, identity verification of signers (currently token link + email match
   only), and per-signature certificates. The market norm is integrate-DocuSign/Adobe;
   keeping our engine is defensible only with a written signature-legality memo per
   jurisdiction.

## Proposal

**Positioning (no code):** "Deal intelligence with proof, from first draft to renewal."
Keep founder/SMB motion running; add an Enterprise tier sold on auditability, SSO, and
retention rather than features. Fix or evidence every marketing claim first (SOC 2,
hosting region, encryption) — an enterprise buyer verifies these before anything else.

**Phase E1 — pass IT review (buys the right to compete):**
SAML SSO via Supabase SSO (one integration, Okta/Azure AD/Google covered), TOTP MFA
(Supabase Auth supports it; no current references), SCIM-lite (provision/deprovision
endpoint before full SCIM), DPA + subprocessor list + security page, SOC 2 Type II audit
kickoff (Type I interim if timeline demands), status page + backup/RTO statement.

**Phase E2 — sell the buying committee (teams + governance):**
organizations + RBAC (owner/admin/member/viewer) on top of existing RLS (add `org_id`
scoping, keep user-scoping as fallback); shared deal rooms (multi-user read/comment on
one audit); immutable audit-log export (hash-chained `activity_events` extract, 7-year
retention setting); value-based approval chains (extend the work-plan approval
primitive, which already has immutable payload hashes); public read API + outbound
webhooks (signed, customer-scoped tokens — new capability, highest security scrutiny).

**Phase E3 — win the legal workflow (differentiation):**
clause-anchored redlining with accept/reject + reason (build on the versioning +
evidence primitives; counterparty participates via scoped token links); obligation
owners + escalation (assignee columns on `monitoring_events`, digest per owner);
integrations in buyer order: Slack/Teams notifications, SharePoint/Drive sync, then
Salesforce/HubSpot; signature-legality memo per jurisdiction or DocuSign handoff for
high-value ceremonies.

**Explicitly not enterprise scope:** building our own IdP, on-prem hosting, FedRAMP/HIPAA
tracks (revisit with a signed anchor customer), per-customer encryption keys.

**First three moves this week:** (1) founder attests or removes the SOC 2/EU/AES landing
claims; (2) SAML SSO spike against staging Supabase; (3) `org_id` data-model RFC
(RLS migration plan + backfill of solo users as org-of-one).

## E1 build status (implemented, verified green)

- **SAML SSO sign-in** (`src/lib/auth/sso.ts`, login page): work-domain form drives
  `signInWithSSO`, returns through the existing `/auth/callback` code exchange.
  Providers configure in Supabase Auth > SSO; unconfigured domains fail closed with an
  honest message. Founder action: register the first customer IdP in staging and run
  one live login before promising SSO in sales calls.
- **TOTP MFA** (`src/components/settings/mfa-section.tsx`, login challenge step):
  enroll/verify/unenroll with manual-entry secrets, AAL2 challenge at password sign-in.
  No QR library: secrets are typed into any authenticator app.
- **SCIM-lite** (`src/lib/scim/`, `/api/scim/users`, `/api/scim/users/[id]`): list,
  provision (verified email, IdP as source of truth), suspend via ban (never delete;
  DELETE refused with 405). Bearer provision token (`SCIM_PROVISION_TOKEN`, 32+ chars,
  fails closed unset). Documented in `.env.example` + `VERCEL_ENV_TEMPLATE.md`.
- **Security + DPA pages** (`/security`, `/dpa`), footer-linked. DPA names live
  subprocessors and the signed-copy-on-request motion.
- **Live status** (`/api/health`, `/status`): app/database/AI checks with an AI-fallback
  spike detector; raw volumes never ship. Converged with an in-flight health design
  from a parallel workstream (its 5 tests pass against this implementation).
- **Not code:** SOC 2 Type II audit kickoff, signed DPA delivery, staging SSO live
  verification, `SCIM_PROVISION_TOKEN` issuance. All with named founder ownership.

## E2 build status, increment 1 (implemented, verified green)

- **Organizations + RBAC foundation** (migration 00091, no data-model breakage: solo
  users unaffected, nothing references `org_id` yet): `organizations` +
  `organization_members` (owner/admin/member/viewer), owner-scoped RLS, all writes
  through ownership-checked RPCs (`create_organization`, `add_organization_member`
  with admin-cannot-grant-admin, `remove_organization_member` with last-owner and
  owner-removal guards). Server actions with pre-migration honest errors, Settings →
  Team UI (create, invite by email with role picker, remove/leave), hierarchy unit
  tests. Member directory shows truncated ids until a service-role email lookup
  lands; invites require an existing Dealenz account.
- **Tamper-evident audit-trail export** (`src/lib/audit/chain.ts` + Settings →
  Privacy download): owner-scoped `activity_events`, SHA-256 chained
  (`sha256-chain-v1`, recomputable, gap-sensitive), bounded at 2000 rows with an
  explicit capped flag.
- **Still E2, not yet built:** org-scoped deal rooms (`org_id` on audits + RLS
  migration), value-based approval chains (needs multi-user deals first), public API
  + outbound webhooks, member email directory.
