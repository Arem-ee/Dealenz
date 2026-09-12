# Dealenz — Product

## Positioning

"Know the risk before you sign."

Anyone entering an agreement — freelance work, a lease, a partnership, a service contract, a purchase agreement, an employment offer — is exposed to terms they didn't write and risks they can't easily see. Dealenz reads the deal (a brief, an email thread, an uploaded contract, a call transcript) and tells you what's risky before you commit, generating protective documents where that's the relevant next step.

A document is one input, not the whole product. Users can also ask Dealenz questions directly, with no document attached: what to think about, what to negotiate, what to ask before agreeing, how two offers compare, or whether to walk away.

Dealenz is an AI deal intelligence platform that helps users understand, evaluate, negotiate, and make decisions about deals. Dealenz works for the user, not for the deal: it optimizes for useful intelligence, not maximum token consumption, and credits pay for computation without buying favorable answers.

**Primary customer: founders and business owners.** Freelance is a supported vertical, not the product centre of gravity. Tier 1 is Founder + Partnership + company deals; Tier 2 is Purchase/Sale, Lease, Employment; Tier 3 is Freelance; Tier 4 is Generic fallback. The original freelancer-only framing ("audit your client before you write the proposal") described the initial vertical that established the architecture — it is now one supported vertical among several, not the canonical Dealenz experience. New product investment prioritises business-owner workflows and grounded legal intelligence (Nigeria/CAMA first, jurisdiction-extensible).

## Core Product Thesis

Dealenz is a **deal intelligence, protection, professional-review, and execution platform**.

The long-term product lifecycle is:

```text
Deal
  ↓
Intelligence
  ↓
Protection
  ↓
Negotiation
  ↓
[Professional legal review when useful/needed]
  ↓
Agreement
  ↓
Execution
  ↓
Monitoring / Changes / Renewal / Disputes
```

The lawyer stage is **NOT mandatory**. Professional legal review is an optional human layer that can enter at appropriate points.

## Two Distinct Product Surfaces

### A. Public Quick Review (Anonymous)

The public landing page provides a limited, anonymous **Quick Review**.

Purpose:
- Acquisition
- Demonstration of value
- Trust building
- Conversion into the full product

The public user can submit a deal and receive a deliberately limited review without creating an account. The anonymous Quick Review uses the NVIDIA free-model path for AI processing, subject to actual provider capabilities and constraints.

The anonymous Quick Review is deliberately constrained relative to the authenticated product, potentially including restrictions around:
- Analysis depth
- Number of reviews
- Document/input size
- Persistence/history
- Evidence depth
- Protection features
- Negotiation functionality
- Execution features
- Professional review
- Other advanced capabilities

### B. Authenticated Full Dealenz Workspace

The authenticated product is the **full Dealenz product**, not merely a larger Quick Review.

It provides:
- Persistent deals
- Full intelligence
- Context resolution
- Evidence
- Risk analysis
- Protection
- Negotiation support
- Drafting/generation where appropriate
- Optional professional legal review
- Execution capabilities
- Monitoring
- Deal history
- Future relationship/deal intelligence

## International-First

Dealenz is designed as an **international-first product**. Nigeria is the founder's/home market, but the product is not architected around the assumption that Nigerian users are the primary customer base.

The product serves international users and international deal contexts. This has implications for:
- Currencies
- Payment infrastructure
- Jurisdictions
- Governing law
- Privacy/data governance
- Professional legal review
- Localization
- Product positioning
- Pricing
- Billing
- Customer support
- Future regional expansion

The product does not assume a Nigeria-only legal, payment, or commercial model. Where jurisdiction-specific matters are unknown, they are marked as requiring future legal/business validation.

## Credit-Based Monetization

The canonical monetization direction is **usage-based credits**, not conventional feature-gated SaaS tiers.

The core commercial unit is **Dealenz work**, represented by credits. Users purchase credits and consume them when they use Dealenz capabilities.

**Credits represent Dealenz work, not raw AI tokens.** Do not expose model token consumption as the customer's pricing model.

## Deal Workload, Not "One Deal = One Credit"

Do NOT define pricing such as "Freelance deal = 1 credit, Lease = 3 credits, Investment = 10 credits." Deal type describes the nature/context of a deal — it does NOT by itself determine cost.

Instead:
```text
Deal
 ↓
Intake / Parsing
 ↓
Workload / Complexity Assessment
 ↓
Required Dealenz Work
 ↓
Credit Cost
```

Workload may consider factors such as:
- Document count, length, structural complexity
- Clause density, number of parties, obligation density
- Financial exposure, risk surface
- Legal/contextual complexity, governing-law uncertainty
- Jurisdiction/applicability questions, cross-document dependencies
- Missing/uncertain context, requested analysis depth
- Protection work, negotiation work, drafting/generation work
- Execution/monitoring workload

These are examples, not a finalized formula. The architecture explicitly allows the workload model to evolve based on actual product economics and usage data.

## User Experience of Credit Cost

The user should not determine workload manually:

```text
User submits deal
        ↓
Dealenz assesses required workload
        ↓
Estimated credit requirement
        ↓
User confirms
        ↓
Work is performed
        ↓
Credits consumed
```

Because workload may not be knowable before intake, the product supports an **estimated workload/credit range** before final consumption.

## Credit Economics & Ledger

Credits are an abstraction over the work Dealenz performs:

```text
Credits
 ↓
Required work
 ↓
AI/model/infrastructure cost
 ↓
Human-review cost where applicable
 ↓
Operational cost
 ↓
Target margin
```

The customer experiences: "This deal requires X credits." Not: "This model used X tokens."

The architecture avoids coupling the commercial model to a particular AI provider.

The architecture anticipates an auditable credit ledger:
```text
Purchase        +500
Deal analysis     -14
Protection        -5
Legal review     -25
Refund            +5
--------------------
Balance          461
```

Required capabilities: credit balances, immutable usage history, purchases, consumption, refunds/adjustments, entitlement/access checks, reconciliation, auditability.

Minimal international purchase is implemented: provider-independent catalog (`src/lib/billing/catalog.ts`, starter/standard/pro in USD/GBP/EUR), Lemon Squeezy buy-link checkout + HMAC-verified webhook (`src/app/api/billing/*`), idempotent allocation through the existing ledger (`credit_purchases` `00037`, no second ledger). Lemon Squeezy is Merchant of Record, so no tax engine is implemented. Prices are provisional configuration, not approved commercial pricing; no subscriptions and no refunds automation yet. Live variant IDs and webhook secret are required production configuration (see `.env.example`).

## Pricing/Tiers

Credits exist, but capabilities should not be arbitrarily crippled by traditional subscription tiers. Everyone conceptually has access to the same core Dealenz intelligence, subject to available credits and legitimate product/security constraints.

Commercial packaging may include:
- Credit bundles
- Recurring credit allocations
- Volume discounts
- Rollover rules
- Team/business packaging
- Priority processing
- Other legitimate commercial benefits

Exact prices, credit amounts, bundles, margins, rollover periods, discount percentages require a separate pricing/economics exercise.

## Lawyer / Human-in-the-Loop Model

Dealenz must NOT become a "freelance platform for lawyers." The core experience is not a lawyer marketplace.

> **Dealenz owns the deal experience. Professional legal expertise is a managed human capability within that experience.**

The user interacts with Dealenz. Dealenz prepares the relevant context. Where professional legal judgment is appropriate, Dealenz can facilitate a professional review.

```text
User
 ↓
Dealenz
 ↓
Deal intelligence
 ↓
Risk / uncertainty / recommendations
 ↓
Optional professional review
 ↓
Dealenz-managed workflow
 ↓
User
```

The lawyer is a **human layer inside the Dealenz workflow**, not the product itself.

## Lawyer Involvement Is Conditional

Not every deal requires a lawyer. Dealenz does NOT artificially escalate users to a lawyer merely to create revenue.

Professional review may be appropriate when:
- The user requests it
- The deal is materially complex
- Financial/legal exposure is significant
- Important uncertainty remains
- Applicable law/context cannot be confidently resolved
- Unusual provisions require professional judgment
- Consequences of an error are substantial

Conversely, Dealenz handles straightforward deals without forcing professional review.

The system does NOT make unqualified legal determinations such as "You don't need a lawyer." Prefer qualified language: "Based on the factors Dealenz can assess, professional review does not appear necessary."

## Lawyer Revenue Model

The architecture supports professional review as a monetizable Dealenz service. Possible models:
- Additional credits
- A defined credit-based professional-review service
- Included review allowances in future packages
- Other Dealenz-managed service models

Dealenz receives revenue from professional-review services while maintaining ownership of the customer/deal experience. Do not design a lawyer marketplace.

Money boundary (implemented): Dealenz software/credits run on Lemon Squeezy; lawyer professional services are recorded as service orders (`service_orders`, migration `00044`) and never touch the credit ledger. Credits cannot become money and money never becomes credits. Paystack is the planned rail for lawyer-service payments; no payout integration is implemented — quoted/paid/fulfilled order states and all payout/fee/tax/escrow rules are explicit future product decisions.

## Lawyer Workflow

When professional review occurs, Dealenz prepares a structured handoff so the professional does not start from zero.

Potential inputs:
- Original documents
- Extracted facts
- Deal context
- Applicable context/framework
- Identified risks
- Supporting evidence
- Unresolved uncertainties
- User concerns/questions
- Relevant Dealenz analysis

The professional provides judgment including:
- Confirmation/rejection/modification of findings
- Additional concerns
- Clause-level observations
- Recommended changes
- Answers to user questions
- Professional advice
- Communication back to the user

## Lawyer Feedback Must Not Automatically Become Law

A lawyer's individual opinion must NOT automatically become a universal Dealenz rule or knowledge-base fact.

```text
Lawyer opinion
 ↓
Candidate knowledge/rule insight
 ↓
Expert review / validation
 ↓
Approved versioned framework
 ↓
Future Dealenz use
```

## Core Deal Intelligence Model

The architecture preserves the distinction between:

| Layer | Description |
|-------|-------------|
| **Deal evidence** | What the submitted deal/document actually says |
| **Legal authority** | What applicable law/regulation/case authority establishes |
| **Industry evidence/practice** | What relevant professional/commercial practice indicates |
| **Commercial reasoning** | Why a provision matters economically or operationally |
| **Dealenz recommendation** | What Dealenz recommends the user consider doing |

These must not be conflated. Not every finding requires a legal citation. Not every commercial concern is a legal violation. Not every contractual problem is illegal.

## AI Authority Boundary

AI is a cross-cutting capability. AI may assist with:
- Extraction, classification, context inference
- Evidence mapping, explanation, summarization
- Drafting, negotiation suggestions, protection suggestions
- Uncertainty identification

**AI must NOT become the final authority for legal/risk conclusions.**

AI may NOT:
- Assign risk scores (deterministic rules do this)
- Determine legal requirements (codified rules + authoritative sources do this)
- Decide enforceability (requires legal judgment + jurisdiction)
- Invent risk categories (defined per deal type module)
- Invent legal rules (rules come from codified knowledge base)
- Decide "this is illegal" (requires legal judgment + jurisdiction)
- Override deterministic rule outcomes (AI explains, never overrides)
- Set severity thresholds (defined per deal type module)
- Decide "this clause is illegal" (requires legal authority + jurisdiction)
- Replace lawyer judgment (lawyer escalation is for judgment)

If applicable deterministic/authoritative analysis cannot be confidently performed, Dealenz:
- Identifies what is unknown
- Explains why it matters
- Limits the conclusion
- Requests/derives additional context where appropriate
- Recommends professional review when warranted

## Deterministic Authority

Dealenz pairs deterministic checks with AI reasoning. Deterministic rules establish verifiable facts (a condition exists, a piece of context is missing, a knowledge item applies, a threshold was exceeded) without depending on the model. The AI then explains what those findings mean for the user, in plain user-first language, without changing them. Unknown stays unknown: the system would rather ask or qualify than guess.

Where the system observed something in the user's own input, findings can point back to the observed text and where it came from. Absence of such a pointer means nothing was observed there, not that nothing exists.

The system never manufactures certainty simply because an LLM is available.

## Context Resolution

Context is first-class but NOT a rigid questionnaire. The preferred flow is iterative:

```text
Infer
 ↓
Extract
 ↓
Resolve context
 ↓
Confirm / refine
 ↓
Analyze
 ↓
Discover further required context
 ↓
Refine if necessary
```

Context includes: deal type/category, parties, party roles, geography, place of performance, governing law, jurisdictional connections, regulatory environment, industry, transaction structure, financial exposure, intended outcome, negotiation position, other material facts.

Distinguish where relevant between: party location, place of performance, jurisdictional connection, governing law, applicable mandatory law, regulatory regime.

Do not invent legal conclusions about how these interact.

## Knowledge Architecture

The product requires a knowledge layer distinguishing and governing:
- Legal authority
- Regulations
* Relevant case authority where applicable
- Industry practice
* Commercial norms
* Dealenz recommendations

Knowledge must support: provenance, applicability, jurisdiction, effective dates, versioning, uncertainty, conflict handling, source traceability.

Do NOT impose a simplistic universal hierarchy (statute > regulation > case law > industry practice). Applicability depends on legal system, authority, subject matter, hierarchy, effective dates, conflicts, and context.

Do not invent legal rules. Do not build a full legal CMS in this documentation phase.

## Live Legal Research (International-First)

Dealenz is international-first: US/UK/Europe are primary target markets; Nigeria is a supported jurisdiction, not the default. Legal research uses an authoritative-source allowlist (`src/lib/legal-research/allowlist.ts` + jurisdiction-keyed `registry.ts`): Tier 1 primary authority (e.g. Delaware Code, legislation.gov.uk, EUR-Lex, CAC/PLAC), Tier 2 authoritative databases, Tier 3 commentary never presented as primary law. Live web content is treated as DATA, never instructions: bounded retrieval (HTTPS-only, SSRF guards incl. metadata endpoints, per-hop redirect re-validation, content-type + byte caps, timeout) via `src/lib/legal-research/retrieval.ts`, default corpus-only unless `LEGAL_RESEARCH_LIVE=1` (server-only). AI synthesizes validated evidence rather than inventing law. Unsupported jurisdictions remain honestly unsupported (`NOT_FOUND`); unknown jurisdiction asks (`NEEDS_JURISDICTION`) instead of guessing. Legal research does not equal legal advice; lawyer review remains available for material uncertainty.

## Deal-Type Architecture

Dealenz supports multiple deal categories. Existing freelance functionality is preserved.

Potential domains (not a frozen taxonomy):
- Freelance/client work
- Employment/contractor relationships
- Leases
- Partnerships
- Founder/co-founder agreements
- Investment/funding
- Commercial agreements
- Service agreements
- Other deal types

Do not freeze the final taxonomy. Do not assume every deal type has exactly the same architecture. Do not prematurely freeze a TypeScript interface. The repository audit will determine the appropriate implementation abstraction (domain modules, capabilities, framework adapters, a combination, or something else).

The documentation defines **requirements and responsibilities**, not premature implementation.

## Example: Founder / Funding Deals (Domain Depth)

Founder/co-founder arrangements may involve: equity, fully diluted ownership, capitalization, vesting, cliffs, acceleration, reverse vesting, leaver provisions, repurchase, dilution, option pools, founder responsibilities, governance, voting, reserved matters, deadlock, IP assignment, confidentiality, transfer restrictions, departure consequences.

Funding/investment deals may involve: investment structure, valuation, ownership, dilution, conversion, liquidation preference, participation, anti-dilution, investor rights, information rights, board/control rights, protective provisions, cap-table effects, financing interactions.

These are examples of domain depth, NOT a request to implement or author legal rules.

## Deal Protection

Dealenz goes beyond identifying problems. The Protection layer helps users act on findings.

Potential capabilities:
- Negotiation intelligence
- Suggested changes, fallback positions
- Clause suggestions
- Proposals, SOWs, contracts, amendments, checklists
- Negotiation preparation
- Lawyer-preparation materials

The architecture makes protection a first-class product layer.

## Deal Execution

The long-term product extends beyond signing.

The Execution layer should eventually support:
- Signed deal state
- Obligations, deadlines, milestones, payments, deliverables
- Changes/change orders, amendments
- Renewals, disputes/escalation
- Monitoring
- Relationship/deal history

Do not implement this now. Do not claim it exists unless verified.

## Billing Architecture

The billing architecture is **provider-agnostic**.

```text
Dealenz Commerce
    ↓
Customers / Billing Accounts
    ↓
Products / Credit Packages / Services
    ↓
Entitlements
    ↓
Credit Ledger
    ↓
Orders / Subscriptions / Transactions
    ↓
Payment Provider Adapter
```

Implemented provider: Lemon Squeezy (buy-link checkout + HMAC-verified webhook, `src/lib/billing/provider.ts`; `credit_purchases` accepts `stripe` (historical) and `lemonsqueezy`, production path writes Lemon Squeezy only). Stripe was an earlier incorrect implementation and is removed from the live path; Paystack and other providers are not implemented.

Evaluation criteria (international-first): international coverage, subscription support, credit purchases, one-time/recurring purchases, currencies, payout availability for a Nigeria-based company, Merchant of Record capabilities, tax/compliance burden, refunds, chargebacks, billing flexibility, professional-service compatibility, long-term scalability.

## Software Payments vs Professional Services

```text
Dealenz Software
      ↓
SaaS / Credit consumption
      ↓
Payment provider

Professional Review
      ↓
Managed professional service
      ↓
Appropriate commercial/payment mechanism
```

Do not assume one payment provider handles every transaction. Payment-provider policies may treat software/SaaS differently from professional legal services. Record provider policy verification as a future business/compliance requirement.

## Trust & Governance

Policies are product/architecture requirements, not merely footer links.

Eventual needs: Privacy Policy, Terms of Service, Cookie Policy, Acceptable Use Policy, AI/automated-analysis disclosure, legal disclaimer/scope-of-service disclosure, data retention/deletion policy, refund/cancellation policy, professional legal-service terms where applicable.

The architecture must account for policy-controlled behavior. Do not write legal documents now. Do not invent legal language.

## Data Governance

Unresolved questions requiring future product, legal, security, or provider decisions:

- Are uploaded documents stored? For how long?
- Are extracted facts retained? Generated documents retained?
- Are anonymous Quick Reviews retained?
- What data is sent to AI providers? What do providers retain?
- Is data used for model training?
- Can users delete all data? What happens after account deletion?
- What does a lawyer receive? How long can professional reviewers access the deal?
- What happens to professional notes?
- What gets logged? What requires explicit consent?

Do not invent answers. Clearly mark unknowns requiring future decisions.

## Security Principle

Preserve existing security philosophy:
- Least privilege
- Server-side authority where appropriate
- RLS defense in depth
- Protected secrets
- Validated inputs/files
- Controlled document access
- Auditable sensitive actions
- Minimal data exposure
- Explicit consent for professional handoff
- No unnecessary retention

Do not redesign security implementation in this phase.

## Current vs Target vs Staged vs Open/Unknown

This distinction is mandatory. Both documents clearly distinguish:

### CURRENTLY DOCUMENTED
What the existing documentation says.

### CURRENTLY OBSERVED
What can be verified from high-level repository inspection.

### TARGET FULL-PRODUCT ARCHITECTURE
What Dealenz is intended to become.

### STAGED / PLANNED
What will be implemented incrementally later.

### OPEN / UNKNOWN
Questions requiring audit, research, validation, or founder decisions.

Do not blur these categories. Do not claim future architecture already exists. Do not claim existing capabilities without verification.

## Preserve Existing Value

The current freelance intelligence flow is substantially built. The canonical architecture preserves its conceptual value:

```text
Existing Dealenz capabilities
        ↓
Preserve what is sound
        ↓
Reorient architecture
        ↓
Add context / knowledge / protection / human / execution layers
        ↓
Expand deal coverage
```

Do not recommend throwing away working functionality without evidence.

---

## OPEN PRODUCT DECISIONS

1. **Deal-type launch sequence**: Freelance (done) → Lease vs Founder vs Generic-first? *Recommendation: Lease next (clear rules, high demand, distinct from freelance)*

2. **Knowledge sourcing**: Partner with legal publisher? Build in-house with counsel? Crowdsource from lawyers? *Need decision before building KB architecture*

3. **Generic mode future**: Keep as AI-only fallback? Build lightweight rule engine for common categories? *Recommend: lightweight rules for "contract quality" universals*

4. **Lawyer compensation model**: Per-consultation? Subscription? Revenue share? *Need business model decision before building lawyer workflow*

5. **Jurisdiction coverage v1**: US (CA, NY, DE) + UK only? Or accept global with "limited coverage" disclaimer? *Recommend: explicit supported jurisdictions list*

6. **Context confirmation UX**: How many fields before user fatigue? *Recommend: progressive — required first, recommended inline, optional collapsible*

7. **Rule DSL vs code**: TypeScript functions with Zod schemas? JSON AST? Custom DSL? *Recommend: TypeScript functions with Zod schemas for now; DSL if rule count > 100*

8. **AI provider lock-in**: Current abstraction handles Gemini + OpenAI-compatible. Sufficient? *Yes for now; add Anthropic when needed*

9. **Client intelligence (repeat counterparties)**: Build now or later? *Later — need volume first*

10. **Post-signature monitoring**: Build hooks now (event log) or full module later? *Build event log hooks now; execution module later*

---

## CURRENTLY OBSERVED (High-Level Repository Inspection)

- **Freelance deal type**: Fully implemented end-to-end (intake → extraction → risk analysis → protection intelligence + protection package generation → PDF export → e-signing)
- **Lease/Purchase/Employment/Generic deal types**: deterministic protection intelligence (findings + negotiation points where applicable) with document generation honestly unavailable (freelance-only via `src/lib/protection` boundary)
- **Founder/Partnership deal types (Tier 1)**: deterministic protection intelligence **plus** structured protection intents (`ProtectionIntent` per FAIL finding with priority, rationale, legal citation, variables→UNKNOWN) and curated clause suggestions (Founder 8, Partnership 8, structure-aware for LLP/LP/ordinary, drafting assistance labelled, `{{var}}` preserved) **plus** international document generation (`src/lib/documents` families `founder-agreement`/`llp-agreement` etc., `assembleDraft` jurisdiction-aware `Nigeria`/`Testland` neutral, `generateBusinessOwnerDraft` server action, `BusinessOwnerDocumentSection` UI: select family → confirm jurisdiction → resolve missing → review clauses → generate draft → provenance/legal citations → review/export/handoff)
- **Document Generation boundary**: `canGenerateDocuments` — freelance → allowed via `src/lib/generate.ts`, founder/partnership → allowed via `src/lib/documents` business-owner pipeline (international, jurisdiction-explicit, `hasProtectionDraftSupport` true), other verticals → unavailable (tested per deal type; Founder/Partnership never route through Freelance)
- **Referrals**: invite link + attribution on signup, reward on first completed analysis via credit ledger (reward amount provisional, pending sign-off)
- **Landing page**: Anonymous Quick Review with mini-dashboard (paste/upload/describe → `/api/analyze-anonymous`)
- **Authentication**: Supabase Auth (email/password + Google OAuth with explicit account linking), email verification required
- **Database**: Supabase/Postgres with RLS on all tables, 35 forward migrations (`00034` Partnership, `00035` Nigeria CAMA/CAC corpus)
- **AI Provider Layer**: Provider-agnostic interface with Gemini, OpenAI-compatible, and Anthropic Claude adapters
- **Risk Engine**: 8 freelance categories (scope, payment, timeline, communication, revision, legal, IP, client behavior) with deterministic rules + AI fallback
- **Document Generation**: Proposal → SOW → Contract → Checklist (sequential AI calls with template fallback)
- **Lawyer Handoff**: Contextual Founder/Partnership “Have a lawyer review this deal” CTA after protection/document, `LawyerHandoffReview` panel showing what will be shared (deal type/jurisdiction, critical findings, protection intents, evidence, legal citations/provenance, draft + missing `{{var}}`, honest limitations), submits via existing `consultation_requests` with `handoff_snapshot` `00036` (preserves evidence/VERIFIED…NOT_FOUND, jurisdiction explicit, no Nigeria leak, structure-aware), waitlist vs requested based on verified lawyers
- **Anonymous Analyze API**: `/api/analyze-anonymous` with IP+fingerprint rate limiting (3/hr)
- **Landing Mini-Dashboard**: Paste/upload/describe → inline risk report
- **Design System**: Mona Sans Variable, light theme (`#F2F0ED`/`#FDFBF9`), extreme glassmorphism (`glass-extreme` 40% white/40px blur)
- **Auth Flow**: Supabase Auth + `src/proxy.ts` as middleware (detected by Next.js 16 by filename convention)

---

## TARGET FULL-PRODUCT ARCHITECTURE (Summary)

Dealenz becomes a **deal intelligence, protection, professional-review, and execution platform** with:

1. **Acquisition** — Landing page, Quick Review, conversion
2. **Identity & Account** — Supabase Auth, email verification, team accounts. One human maps to one canonical account with email/password and Google as identities — Google is linked explicitly, never merged by email comparison.
3. **Deal Intelligence** — Context resolution, extraction, evidence mapping, deterministic risk analysis, AI synthesis
4. **Knowledge** — Structured legal rules, industry practices, deal-type schemas, versioned with provenance
5. **Deal Protection** — Negotiation intelligence, clause library, document generation, lawyer handoff
5. **Human Legal Review** — Structured handoff, lawyer workflow, feedback loop
6. **Deal Execution** — Obligations, change orders, monitoring, relationship intelligence
7. **Commerce** — Credit-based, provider-agnostic, software vs professional services separation
8. **Trust & Governance** — Policies as architecture, data governance, security principles

**AI** is a cross-cutting capability (extraction, classification, context, explanation, drafting, synthesis) — subordinate to the system's authority/evidence/governance model.

---

## STAGED / PLANNED

| Phase | Focus |
|-------|-------|
| **Current** | **Business-owner first + International docs + Lawyer handoff:** Founder + Partnership are Tier 1 first-class verticals (8 rules each, Nigeria CAMA/CAC legal corpus via `src/lib/legal-research` + `00035`, grounded Ask with citations, `src/lib/verticals/tier.ts` DealTypeSelector founder-first, `src/lib/protection` intents+8+8 clause library with `{{var}}` UNKNOWN, `src/lib/documents` international families `founder-agreement`/`llp-agreement` etc. jurisdiction-aware `Nigeria`/`Testland` neutral via `assembleDraft` + `generateBusinessOwnerDraft` server action + `BusinessOwnerDocumentSection` UI, `src/lib/consultation/handoff.ts` `HandoffPackage` + `00036` `handoff_snapshot` + `LawyerHandoffReview` CTA/review for Founder/Partnership); Lease/Purchase/Employment Tier 2 (8-9 rules); Freelance Tier 3 preserved (9 rules + 8-category engine, `src/lib/generate.ts` isolated, `canGenerateDocuments` freelance-only, `hasProtectionDraftSupport` for founder/partnership draft); Generic Tier 4 fallback (7 rules) + Google linking + Referral MVP + Anonymous Quick Review + Context/Knowledge/Evidence/Conversation/Credits + Protection intelligence/Documents split |
| **Next** | Nigeria legal corpus expansion (contract, employment, property, IP, NDPA/NDPC, tax) + partnership LLP/LP/ordinary clause variants + execution-aware templates |
| **Future** | Full lawyer marketplace + execution/monitoring + background jobs |
| **Future** | Deal Execution (obligations, change orders, monitoring) |
| **Future** | Client intelligence (repeat counterparties) + Relationship history |

---

## OPEN / UNKNOWN

1. **Knowledge sourcing strategy** — Partner with legal publisher? Build in-house with counsel? Crowdsource from lawyers?
2. **Lawyer compensation model** — Per-consultation? Subscription? Revenue share?
3. **Jurisdiction coverage v1** — Explicit supported jurisdictions list needed
4. **Rule representation** — TypeScript functions + Zod schemas vs JSON AST vs custom DSL?
5. **Dependency vulnerabilities** — High-severity issues across Next.js, PostCSS, sharp, transitive packages
6. **CI/CD pipeline** — No pipeline exists; need `npm test` wired first
7. **Backup & recovery** — No stated RPO/RTO; relying on Supabase automated daily backups
8. **Data retention policy** — No stated policy; need decision before real user data
9. **Payment provider economics** — Lemon Squeezy is implemented (Merchant of Record); remaining questions are payout availability and whether professional services need a separate mechanism — not provider selection
10. **Professional services payment** — Separate mechanism from software credits?

---

## PRESERVE EXISTING VALUE

The current freelance intelligence flow is substantially built. The canonical architecture preserves its conceptual value:

```text
Existing Dealenz capabilities
        ↓
Preserve what is sound
        ↓
Reorient architecture
        ↓
Add context / knowledge / protection / human / execution layers
        ↓
Expand deal coverage
```

Do not recommend throwing away working functionality without evidence.