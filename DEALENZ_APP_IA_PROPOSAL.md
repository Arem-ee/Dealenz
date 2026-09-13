# Dealenz — Authenticated App IA Proposal
**Date:** 2026-09-13 · **Scope:** Authenticated app only (`/dashboard`, `/deals`, `/ask`, `/billing`, `/clients`, `/templates`, `/risk-intelligence`, `/lawyer`, `/admin`) — landing `src/app/page.tsx` untouched.  
**Evidence standard:** Every claim cites `file:line` or `supabase/migrations/*`. Screenshot `Screenshot_2026-09-13_034258.png` referenced as the current Home dashboard (Needs Your Attention / In Progress / Quick Start / Recent Activity) that this proposal replaces.

---

## Phase 1 — Inventory: What Actually Exists

### 1.1 Deal types and what each supports

**Canonical union** — `src/lib/deal-type.ts:10` `DealType = "freelance" | "generic" | "lease" | "purchase_sale" | "employment" | "founder" | "partnership"` (7). DB constraint has converged via six migrations to the same set — `supabase/migrations/00034_allow_partnership_deal_type.sql:5` final `IN ('freelance','generic','lease','purchase_sale','employment','founder','partnership')` (evolution `00019 → 00027 → 00029 → 00030 → 00032 → 00034`).

| Deal type | Intake | Extraction | Risk analysis | Protection intelligence | Document generation | Lawyer handoff |
|---|---|---|---|---|---|---|
| **Freelance** | `workspace-client.tsx:100` 6-stage `MOBILE_STAGES` `intake → risk-analysis → proposal → sow → contract → checklist` | `generate.ts:234` AI + template fallback | `analyzeRiskForDealType` + 8-category `RiskReport` | `findingsPanel` + `negotiationPoints` | **Full 4-doc package** `src/lib/protection/index.ts:19` `canGenerateDocuments` only freelance → `generateDocuments` (`proposal/sow/contract/checklist` via `generate.ts:254-318`) + `workspace-client.tsx:882` `ProtectionPackage` | `lawyer-escalation.tsx` (note → `createConsultationRequest`) |
| **Founder** | `founder: ["intake","risk-analysis","documents"]` `workspace-client.tsx:101` — no proposal/sow pipeline | Generic `GenericRiskReportView` | Generic adaptive report | **26 intent categories** `protection/intents.ts:15` → `protectionIntentsFromFindings(dealType, findings, jurisdiction)` + `legalContext` per category | **No direct `generateDocuments`**; instead **`assembleDraft`** `src/lib/documents/assembly.ts:112` via 8 Founder clauses `clauses.ts:55` (`FOUNDER_CLAUSES`: ownership, vesting, IP, governance, leaver, transfer s140, liability, dilution) + 4 Founder families `families.ts` (`founder-agreement`, `shareholders-agreement`, etc.) — jurisdiction required, `missingVariables` stay `{{var}}` | `business-owner-document.tsx` + `lawyer-handoff-review.tsx` → `buildHandoffPackage` with `legalCitations` filtered to deal country (`handoff.ts:91`) |
| **Partnership** | Same 3-stage | Generic | Generic | Same intents engine (contribution, profit, authority, deadlock, transfer, exit, IP, liability — 8 clauses `PARTNERSHIP_CLAUSES:178`) + families (`partnership-agreement`, `llp-agreement`) | Same `assembleDraft` path, honesty clamp: ordinary partnership vs LLP check `clauses.ts:294` | Same handoff |
| **Purchase/Sale** | Same | Generic | Generic | Tier-2 category dispatch `purchase-` prefix `intents.ts:81` → payment/subject/delivery/warranty/transfer/termination/liability; legal table `TIER2_LEGAL_CONTEXT` `purchase_sale.US→us-ucc-article2-sale`, `UK→uk-sale-goods-1979`, `EU→eu-sale-goods-directive-2019-771`, `DE/FR/NL→de-bgb/fr-code/nl-bw` | 3 clauses `PURCHASE_SALE_CLAUSES:301` (price/payment, inspection, title) + families (`purchase-terms-sheet`) | Same |
| **Lease** | Same | Generic | Generic | Same tier-2 (payment, term, maintenance, transfer) → `lease.US-CA→us-ca-civil-tenancy`, `UK→uk-landlord-tenant-1954` etc. | 4 clauses `LEASE_CLAUSES:349` (rent/deposit, term, maintenance, subletting) + `lease-terms-summary` | Same |
| **Employment** | Same | Generic | Generic | payment/compensation, roles, termination → `US→us-flsa-wages`, `UK→uk-employment-rights-1996` | 3 clauses `EMPLOYMENT_CLAUSES:412` + `employment-terms-summary` | Same |
| **Generic** | `["intake","risk-analysis"]` `workspace-client.tsx:107` — **no documents stage at all** | Generic | Generic | `findingsPanel` + `negotiationPoints` only, `documentGenerationUnavailableMessage` card | None — `canGenerateDocuments=false` + `hasProtectionDraftSupport=false` → `src/lib/protection/index.ts:28` `"Document generation for this deal type is coming soon."` | No `BusinessOwnerDocumentSection`, no handoff intent block |

**Stage truth:** Generic engine `src/lib/deal/stage.ts:8` is `intake|analyzing|needs_info|ready_protect|ready_documents|lawyer_next|signing_next|completed|failed` — deal-type specifics live only in `workspace-client.tsx:98-108` and `stage.ts` is not per-vertical. Document pipeline is **freelance-only**; Tier 1 (Founder/Partnership) is intentionally **intents + clauses + assembled draft families**, not 4-doc generation. `context_envelope` `supabase/migrations/00021_audit_context_envelope.sql` carries `dealType, jurisdiction, governingLaw, userRole, industry, structure…` with `gate.ts` `READY|NEEDS_CONFIRMATION|MISSING`.

**Evidence of Tier 1 primacy:** `architecture.md` claims Founder/Partnership Tier 1, but code confirms they have richer protection drafting (8+8 clauses) than Purchase/Lease/Employment (3-4 clauses) and a distinct document-assembly path (`assembly.ts` + `families.ts`). Freelance remains the only fully automated 4-doc flow.

### 1.2 Top-level features and backend reality

| Feature | What exists (code) | What is stub/preview |
|---|---|---|
| **Ask + legal citations** | `src/app/ask/page.tsx:14` → `getAskContext` → `AskClient` `src/components/ask/ask-client.tsx:268-341` renders `findings` (evidence + Inspect source), `sources` (top 3 knowledge), `legalCitations` (`LegalCitation` `src/lib/legal-research/types.ts:58` + `researchState` `VERIFIED|SUPPORTED|CONFLICTING|STALE|UNVERIFIED|NOT_FOUND|NEEDS_JURISDICTION`): `ask-client.tsx:311-331` shows `title — section: "passage" [url]` + `jurisdiction · Tier · effectiveStatus · retrieved`. Pipeline `src/lib/conversation/request.ts:330-411` jurisdiction hierarchy `envelope → text detection → UNKNOWN` (never Nigeria), `LEGAL_RESEARCH_LIVE=1` env-gated `getResearchAdapter`, `credits: 1/3/8` via `credits/pricing.ts:19` | — |
| **Risk Intelligence** | `src/app/risk-intelligence/page.tsx:23-48` static library 3×3 patterns (Scope/Payment/Legal) + `audits where risk_report!=null` `withFlags:70` showing flagged deals (`border-l-risk-high`). **Educational only**, no user-specific risk persistence beyond deals. | — |
| **Templates** | `src/app/templates/page.tsx:20-33` 12 static templates `proposal/sow/contract/checklist` ×3, filter by `?category`, CTA `→ /audit/new?template=id` | — |
| **Clients** | `src/app/clients/page.tsx:21` `audits` preview, `src/app/clients/[id]/page.tsx:32` `client_profiles` + `audits where client_id=id` per-deal trust strip | **Preview** — `clients/page.tsx:39` “No client profiles yet… Full history, risk patterns … not available yet”; no aggregation, no `project` model |
| **Billing/credits** | `src/app/billing/page.tsx:74-101` `usage_tracking` (5 `analyzeDeal`, 10 `generateProtectionPackage` via `rate-limit.ts:5`) — free tier — plus `credit_ledger` `supabase/migrations/00023_credit_ledger.sql` advisory-locked `reserve_credits` → `finalize/void`; `CREDIT_PACKAGES` `catalog.ts:22` starter 50 $19 / standard 150 $49 / pro 400 $99; `Ask` flat `1/3/8` (`pricing.ts:19`) via `authorizeOperation` → `completeOperation` | — |
| **Referrals** | `supabase/migrations/00033_referral_system.sql` `referral_codes/attributions` + `lib/referrals/policy.ts:10` 5 credits, `billing/actions.ts:23` `ensure_referral_code`, `referral-section.tsx` copy | — |
| **Lawyer handoff** | `src/app/audit/[id]/consultation-actions.ts:58` `createConsultationRequest` → `consultation_requests` + `tryAutoAssign` `rpc auto_assign_review`; `lawyer-escalation.tsx` (freelance textarea) + `lawyer-handoff-review.tsx:90` (intents + legalContext + evidence + draft) via `buildHandoffPackage:57` (findings FAIL-only, jurisdiction-filtered citations, missing vars preserved) | — |
| **Vault-style docs today** | Dual model: legacy `audits.structured_data.generatedDocuments` (quick load) + `document_versions` versioned source-of-truth (`src/lib/generate.ts:914` + `src/lib/documents/assembly.ts:1115`) + `final_documents` + `document_signers` (`document-actions.ts:68` `finalizeDocument` needs latest + not already executed) + `checklist_items` | **Scattered** — source upload (`raw_input` + `audit-files/{uid}/{audit}/` `storage 00014`), generated docs (`FinalDocumentsPanel`), drafts (`BusinessOwnerDocumentSection`), risk report, handoff snapshot — no single Vault screen; `deals/page.tsx` is just grouped links |

### 1.3 Every authenticated route under `src/app`

Public: `/` `page.tsx` Landing, `/login`, `/register`, `/privacy`, `/terms`, `/sign/[token]` + `/view/[token]` (token-only, `view/[token]/page.tsx:33` IP throttle `shareview:ip 60/3600`).

Authenticated (requires `createClient().auth.getUser()` → `redirect("/login")`; second gate `!email_confirmed_at → /dashboard` for most):

- `/dashboard` `dashboard/page.tsx` — Home (now `HomeHero` + `HomeContinuation` from Phase 15; screenshot shows old `Needs Your Attention / Risk Alerts / In Progress / Quick Start / Recent Activity`)
- `/dashboard/activity` `activity/page.tsx:37` — `activity_events` 50 rows
- `/dashboard/settings` `settings/page.tsx` — `business_profiles` + `SettingsClient`
- `/deals` `deals/page.tsx:34` — `audits` 50, grouped by `stageOrder` intake/processing/analyzed
- `/audit/new` `audit/new/page.tsx:11` — `DealTypeSelector` 7 types → `createAudit(template,dealType)` `audit/new/actions.ts:10` seeds `context_envelope` `version1 dealType user_confirmed`
- `/audit/[id]` `audit/[id]/page.tsx:13` — gate + `activity_events` 100 + `document_versions` count → `WorkspaceClient` (`intake | risk-analysis | protection | documents` per deal type)
- `/ask` `ask/page.tsx:14` → `getAskContext` → `AskClient` with `balance, audits, conversations, initialConversationId/ AuditId`
- `/billing` `billing/page.tsx:63` — `usage_tracking` `analyzeDeal`, `credit_purchases` 20, `credit_balance` RPC
- `/clients`, `/clients/[id]` — preview as above
- `/templates` — static 12
- `/risk-intelligence` — library + flagged deals
- `/lawyer`, `/lawyer/profile`, `/lawyer/reviews`, `/lawyer/reviews/[id]` — `verification_status=verified` fence
- `/admin/lawyers` — `isAdminSessionUser`

### 1.4 Current nav exactly as coded

`src/lib/nav.ts:20-36` — single source:

```ts
PRIMARY_NAV = [{Home,/dashboard}, {Deals,/deals}, {Ask,/ask}, {Billing,/billing}]
SECONDARY_NAV = [{Clients,/clients}, {Templates,/templates}, {Risk Intelligence,/risk-intelligence}]
ACCOUNT_NAV = [{Activity,/dashboard/activity}, {Settings,/dashboard/settings}]
```

Rendered identically:

- `src/components/sidebar-nav.tsx:47` maps `PRIMARY_NAV` then label `Workspace` then `SECONDARY_NAV`, bottom avatar dropdown maps `ACCOUNT_NAV` + conditional `isLawyer → /lawyer` (verified)
- `src/components/mobile-nav.tsx:13` `BAR_TABS = PRIMARY_NAV[0..2]` (Home, Deals, Ask) + center FAB `+ → /audit/new` + `More` sheet `PRIMARY_NAV.slice(3) + SECONDARY_NAV + ACCOUNT_NAV`
- `src/components/top-nav.tsx:129` hard-codes same 4 primary links `Home|Deals|Ask|Billing` with `isActiveEntry`, plus `Search` + `Bell` (`getRecentNotifications` → `activity_events`) + `CreditControl ◇` (`home/credit-popover.tsx` Phase 15) + `New Deal`

`titleFor()` `src/lib/nav.ts:44` maps `pathname` → `Home|Deal|Deals|Ask|…`.

### 1.5 Stale / does-not-map

*   **Screenshot dashboard (`Needs Your Attention / In Progress / Quick Start / Recent Activity`)** — code at `7036959` pre-Phase-15 `dashboard/page.tsx` was replaced in Phase 15 by `HomeHero`; screenshot is now historic.
*   **`Analyzes: 0/5, Generations: 0/10` (`src/components/usage-display.tsx:24` + `dashboard/layout.tsx:99` pre-Phase-15, `dashboard/actions.ts:86` + `lib/rate-limit.ts:5` limits `analyzeDeal:5, generateProtectionPackage:10`)** — **not stale.** Maps directly to free tier `usage_tracking` + `increment_usage(00018 check-first)`; `billing/page.tsx:143` still shows `usedAnalyses/rateLimitFor("analyzeDeal")` as `Free AI analyses used today`. Phase 15 removed the header `UsageDisplay` from layout in favor of quiet `◇` credit popover, but the counter remains the canonical free-tier display on `/billing`. It is not left over from an old credit model — credits (`credit_ledger` `00023`) are Ask-only (`Ask: 1/3/8`), free analyses never touch the ledger (`architecture.md` free vs ledger split). The header meter was cut because it duplicated `/billing`, not because the limit was wrong.
*   **`Clients`** — exists as real `client_profiles` table + link `audits.client_id`, but `/clients/page.tsx:39` is preview copy and no risk aggregation yet; nav presence implies more than exists.
*   **`Risk Intelligence`** — exists as `knowledge_items` (19 seeds: 3 freelance + 6 NG + 10 Tier 2) + flagged audits, but UI `risk-intelligence/page.tsx:23-48` is a static 9-pattern library, not a personal intelligence layer — label overpromises.
*   **`Templates`** — 12 static entries, no DB; functional via `/audit/new?template=` but limited to `proposal/sow/contract/checklist` freelance families.

---

## Phase 2 — Proposal: Authenticated IA sized for solo founders/business owners

**Principles:** Founder/Partnership Tier 1 means protection drafting + jurisdiction honesty, not data rooms. Deals are **one agreement at a time**; the Vault is a single deal's document home, not enterprise storage. Citation/evidence is already a first-class pattern in Ask — make it consistent everywhere a claim cites a source. Extend the existing `Mona Sans + burgundy + light glass` system with more structural confidence, not a new visual language.

### 2.1 Revised top-level nav

**Goal:** Nav should mirror what the backend can actually do for a solo principal, ordered by workflow frequency. Secondary grouping `Workspace` currently hides the most differentiated Tier 1 value (Risk Intelligence) alongside two preview features.

**Proposed `PRIMARY_NAV` (order matters):**

1. **Home** `/dashboard` — conversational entry (existing). Keeps `LayoutDashboard`. First visit orientation + returning `Continue` / `Your deals`.
2. **Deals** `/deals` — every `audits` row the user owns (50). Icon `IconDeal`. Today it is just grouped links; propose adding lightweight status + `riskLevel` chips (already in `withFlags`) — no new backend.
3. **Ask** `/ask` — citation-grounded Q&A already live (legal citations + findings evidence + knowledge sources). Keep `MessageCircle`. Move closer to Deals because Ask is the daily helper between deals, not a secondary tool.
4. **Vault** *new label, same routes collapsed* — **replaces `Templates + Clients + Risk Intelligence` scattered top-level**. Vault is the single deal’s document home (see §2.3). Top-level `Vault` can simply resolve to `→ /deals` today with a second tab, or to `/vault` that is the deals list filtered to “documents”; no new table. This absorbs Templates as “New from template” inside Vault, not its own top-level.
5. **Billing** `/billing` — stays last primary; quiet `◇` stays in header, not nav body.

**Demote / cut:**

- `Clients` `/clients` — **demote to `Deals` filter or Vault sub-tab**, or hide until `client_profiles` has more than name/company. Backend exists but UI is preview; top-level implies成熟 CRM that doesn’t exist. Keep route for direct links, remove from primary/secondary. *Dependency if full CRM desired:* aggregation queries on `audits.client_id`.
- `Templates` `/templates` — **absorb into Vault / New Deal**. Keep `templates` as static catalog but entry via `Vault → New → Template` and `audit/new?template=`; remove from `SECONDARY_NAV`.
- `Risk Intelligence` `/risk-intelligence` — **do not keep as top-level library**. Its flagged-deals slice duplicates `/deals` filtered to `risk_report != null`; its 9-pattern library belongs inside `Deal → Risk` and `Vault` education, not a destination. Cut route or keep as `/risk-intelligence` redirect to `Vault` education.
- `Activity` stays in avatar menu (`/dashboard/activity`); `Settings` stays.

**Implementation:** Single edit to `src/lib/nav.ts:20-36` — new constants `PRIMARY_NAV = [Home, Deals, Ask, Vault, Billing]`, `SECONDARY_NAV = []` or `[Activity, Settings]` moved to `ACCOUNT_NAV`. `sidebar-nav.tsx:67`, `mobile-nav.tsx:104`, `top-nav.tsx:129` all read from it, so change propagates.

### 2.2 Redesigned Home — what it orients around

**Today** (post-Phase 15): `HomeHero` `What are you working on? → Tell Dealenz…` + file chip + example prompts + `HomeContinuation` `Continue` (4 convos) + `Your deals` (5 deals) or intentional empty dashed state. Already far better than the screenshot’s “Needs Your Attention” dashboard.

**Proposal (no new backend):**

*Day-one founder (0 deals, 0 conversations):* Keep current empty dashed card **but add one explicit jurisdiction nudge** directly in hero: subtle row under textarea `Jurisdiction: auto-detected · change` that writes `context_envelope.fields.jurisdiction` via `confirm.ts:20` before analysis. Today jurisdiction is inferred; new Home makes it visible once, preventing the `UNKNOWN → NEEDS_JURISDICTION` research limbo (`request.ts:384`, `handoff.ts:77`, `assembly.ts:145`).

*Returning founder (2 deals in progress, 1 conversation):*

```
What are you working on?  [large textarea]
[Add a document]  Enter to send · 3 example chips

Continue —  Merger chat "Should I accept vesting clause?" → /ask?conversation=…
Your deals — Acme Founder Agreement · founder · High risk · 3 findings need input → /audit/…
Recent — only if activity_events exists (hide otherwise)
```

No usage counters, no `Quick Start` giant card. Credit `◇` already quiet in `TopNav`. Keep `ErrorPanel` for `?error=create-failed`.

**Why this maps to backend:** `deals` uses real `audits` 20 + `riskLevel` extraction (`dashboard/page.tsx:27`), `Continue` uses real `listConversations` 30, no fake analytics. Jurisdiction nudge maps to `context/schema.ts` field already required for every Tier 1 protection intent.

### 2.3 Deal workspace — Vault-sized for Dealenz

**Current:** `src/components/audit/workspace-client.tsx:524` left `StageStepper` 56/3-stage + center report/timeline tabs + right `ContextualPanel`, bottom scattered `ProtectionPackage` / `BusinessOwnerDocumentSection` / `FinalDocumentsPanel`. Documents live in `audits.structured_data.generatedDocuments` + `document_versions` but are rendered in three different places.

**Proposed single-deal layout (same 3 data sources, one home):**

```
[left] StageStepper (unchanged 56 / 3-stage)
[center tabs] Overview | Documents (Vault) | Activity
[right] ContextualPanel (jurisdiction, missing vars) + citation rail when present
```

*   **Overview tab** (today’s `Risk Report` content): `FindingsPanel` (with `EvidenceLine` + `Inspect source` modal `document-viewer.tsx`) + `NegotiationPoints` + `ProtectionIntents` (already shows `legalContext` per intent). **Add one consistent rule:** every `ProtectionIntent` (`intents.ts:57` `legalContext`) and every `Ask` `legalCitation` is rendered as `Title — section: "passage" [url] · jurisdiction · Tier` — same `EvidenceLine`/`LegalCitation` component reused. Today `protection-intents.tsx:23-43` already filters `legalContextIds` by `sourcePrefixForCountry` — keep that, just surface everywhere.

*   **Documents (Vault) tab** — *adapts Vault concept to one-deal scale:* single list of **every document tied to this audit**, ordered chronologically:

    1. **Source** — `raw_input` + uploaded files (`audit-files/{uid}/{audit}/` from `attachFileMetadata`) — read-only, “Exact location” evidence inspectable (`observe.ts:202`).
    2. **Generated drafts** — all `document_versions` rows for this `audit_id` (legacy 4-doc + Tier 1 assembled drafts) with `version_number`, `generation_method ai|template|assembled`, `created_at`, `content` — rendered via `renderMarkdown` + `VersionPdfExport`.
    3. **Risk report** snapshot — `audits.risk_report` as versioned artifact.
    4. **Lawyer handoff snapshot** — `handoff_package` (`handoff.ts:30`) with provenance note.

    All already in `document_versions` + `final_documents` + `document_signers` (`document-actions.ts:68`). Single tab removes scattering. `FinalizeDocument` still requires latest + not executed (`document-actions.ts:81`), `Complete deal` still requires no pending signers (`272`). No new table; just a unified `getAllDocumentsForAudit()` selector over `document_versions` (exists via `getFinalDocuments` family).

*   **Activity tab** — existing `Timeline` (`activity_events`), keep.

**Tier 1 founder feel:** `BusinessOwnerDocumentSection` becomes the *primary* Documents content for `founder/partnership` (families + clauses + variables), while `ProtectionPackage` stays primary for `freelance`. No new families; `familiesForDealType` already scoped.

### 2.4 Where citation/evidence must be consistent

**Today evidence is one-off:** `Ask` (`ask-client.tsx:285` `EvidenceLine`) and `FindingsPanel` (`findings-panel.tsx:144` `EvidenceLine`) do it, `ProtectionIntents` shows `legalContext` text but `RiskReportView`/`GenericRiskReportView` do not show evidence uniformly, and `BusinessOwnerDocument` shows citations only after generation.

**Proposal — one EvidenceLine contract across app (no new schema):**

- **Every `Evidence` (`evidence/schema.ts:42` `id, sourceType, location, quote, observationKey, inspectable`) rendered via `EvidenceLine:23` (`Source: "quote" — Deal input / Extracted / knowledge — exact/approximate/unavailable`) + `Inspect source → DocumentViewerModal` (`inspect.ts:129` EXACT) — shown in: `Ask` findings (already), `FindingsPanel`, `ProtectionIntents` (each intent’s `evidence[]`), `RiskReport` findings, `NegotiationPoints` (when backed by evidence), and `BusinessOwnerDocument` provenance.

- **Every `legalContext` / `LegalCitation` (`protection/intents.ts:57`, `legal-research/types.ts:58`) rendered as `Legal sources — VERIFIED · Title — section: "passage" [url] · jurisdiction · Tier · effectiveStatus · retrieved` — shown in: `Ask` `legalCitations` (already `ask-client.tsx:311`), `ProtectionIntents` (extend current text to include URL+passage), `BusinessOwnerDocument` draft header (extend `assembly.ts` provenance), `LawyerHandoffReview` (already but add evidence attach).

- **Never mix:** `evidence` (observation → clause) vs `knowledgeSources` vs `legalCitations` — keep distinct blocks as today `ask-client.tsx:277/301/311`, replicate same order everywhere.

**Dependency if full grounding desired:** central `formatLegalCitation()` helper (new, trivial) to dedupe three render paths — flag as minor frontend-only.

### 2.5 Cuts

*   **`UsageDisplay` header meter** (`src/components/usage-display.tsx`) — already removed in Phase 15 from `dashboard/layout.tsx`; keep removed. Billing remains the single source for `used/5` (`billing/page.tsx:143`). No backend cut.
*   **Top-level `Templates / Clients / Risk Intelligence`** — cut from nav as above; routes stay reachable for deep links but no longer primary. Removes false parity with data rooms.
*   **Legacy `MOBILE_STAGES` `sow`/`checklist` names for non-freelance** — already cut in `workspace-client.tsx:101` but `deals/page.tsx:19` `stageLabels` still maps `draft → Intake / processing → Analyzing` generically; keep that mapping, no separate sows for founder deals.
*   **Nothing else cut** — `audits`, `conversations`, `credit_ledger`, `knowledge_items`, `consultation_requests`, `lawyers`, `activity_events`, `client_profiles` all mapped 1:1.

---

## Open Questions for You Before Build

1. **Nav final labels:** Confirm `Vault` as the collapsed home for Templates/Clients/Risk Library, or prefer `Documents`? Vault implies custody; Documents is literal. Proposed `Vault` keeps premium data-room lineage without scale mislead. If you prefer literal, we swap one constant.
2. **Jurisdiction nudge on Home:** Approve adding a one-line `Jurisdiction: … · change` under the hero before analysis (writes `context_envelope.fields.jurisdiction` via `confirm.ts`). Without it, every first Tier 1 deal hits `NEEDS_JURISDICTION` research limbo.
3. **Clients future:** Keep `Clients` as a deep link only, or invest in aggregation (per-client risk history) to justify top-level? Current data supports per-client deal list but not patterns — `clients/[id]/page.tsx:78` already shows `New client — no history yet`.
4. **Citation component name:** Approve standardizing on `EvidenceLine` + new `LegalCitationLine` for all legal contexts, or reuse existing `ProtectionIntents` text block? This is frontend-only; no schema change.
5. **Mobile `Vault`:** Should `MobileNav` `More` sheet keep the same `PRIMARY_NAV.slice(3) + SECONDARY_NAV` logic after the consolidation, or flatten `Vault` + `Settings` only? Current `mobile-nav.tsx:104` will auto-reflect `lib/nav.ts` change.

**Deliverable is proposal only — no code changed, no migration, no RLS touch.**
