# Dealenz — Product

## Positioning

"Know the risk before you sign."

Anyone entering an agreement — freelance work, a lease, a partnership, a service contract, a purchase agreement, an employment offer — is exposed to terms they didn't write and risks they can't easily see. Dealenz reads the deal (a brief, an email thread, an uploaded contract, a call transcript) and tells you what's risky before you commit, generating protective documents where that's the relevant next step.

A document is one input, not the whole product. Users can also ask Dealenz questions directly, with no document attached: what to think about, what to negotiate, what to ask before agreeing, how two offers compare, or whether to walk away.

Dealenz is a **trust-first deal intelligence and protection product for founders and small business owners, including people who cannot afford a lawyer**. It checks contracts and deals for risk, explains why something is risky, grounds findings in evidence, helps users understand what matters, helps users protect themselves, can generate useful deal documents and work products, can help prepare and execute bounded deal work, can involve a lawyer when appropriate, and eventually monitors completed/signed deals for important events.

Dealenz is an AI deal intelligence platform that helps users understand, evaluate, negotiate, and make decisions about deals. Dealenz works for the user, not for the deal: it optimizes for useful intelligence, not maximum token consumption, and credits pay for computation without buying favorable answers.

Dealenz is NOT:
- merely an AI contract summarizer
- a generic AI chatbot
- a generic autonomous agent
- a CRM
- a lawyer marketplace by default
- a generic sales automation platform

**Trust principle: AI proposes. It never decides.** Dealenz never invents legal certainty, never collapses `UNKNOWN` into `PASS` or `FAIL`, never treats `APPROXIMATE` as `EXACT`, always grounds findings in the source, and leaves consequential actions under explicit user control.

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

## Product Surface

Dealenz is an **authenticated, chat-first, but work-first** deal intelligence and protection workspace.

Chat is the control and conversation layer. The actual work product is the dominant thing — risk reports, findings, proposals, contracts and documents, case files, negotiation material, protection output, and other bounded deal work products. The architecture relationship is:

**Conversation → Work → Output**

rather than:

**Conversation → chatbot response**

Each deal is its own persistent thread and work item. The user gives Dealenz an objective or request, and Dealenz increasingly determines the work required rather than requiring the user to manually sequence every step.

The public landing page describes the product and directs visitors to create an account. There is no anonymous analysis mode. Dealenz is authenticated-only. There is no Anonymous Quick Review, no `/api/analyze-anonymous`, no hidden anonymous fallback, no anonymous AI surface, no anonymous demo pipeline, and no public low-cost analysis mode. The shared `anonymous_rate_limits` table (`00040`) remains as infrastructure for other unauthenticated paths (share-view, auth log, client-error intake) and must not be described as an anonymous analysis system.

### Authenticated Dealenz Workspace

The authenticated product is the **full Dealenz product**.

It provides:
- Persistent deals and threads
- Full intelligence
- Context resolution
- Evidence
- Risk analysis
- Protection
- Negotiation support
- Drafting/generation where appropriate
- Optional professional legal review
- Execution capabilities
- Monitoring — signed-deal and renewal/material-event monitoring with email alerts (part of complete product)
- Deal history and work history
- Relationship/deal intelligence

## Frontend Structure

### Desktop

A resizable split-screen workspace:

**Chat / control layer | Work / output surface**

The work/output side is wider and visually dominant. It may contain findings, reports, documents, proposals, case files, execution progress, approvals, and other work products. The conversation does not visually overpower the actual work.

Implemented as `SplitPane` (`src/components/split-pane`) with `ChatThread` adapted for desktop. The chat input (Composer) is the control layer; the work surface renders richer artifacts.

### Mobile

No desktop-style split pane. A single-column experience where structured work surfaces appear as cards and sections inside the conversation. `useIsDesktop()` selects the layout; mobile stacks work inline.

### Sidebar

Navigation is intentionally small:

- **Home**
- **Library**

Account functionality is grouped in a lower account/settings menu:

- Settings
- Billing
- Help
- Log out

Do not expand the primary navigation into a CRM-style dashboard.

## Visual Language

- One accent color used sparingly (burgundy/oxblood via OKLCH)
- Plain sans-serif for UI controls, labels, and interface text (Mona Sans Variable)
- Serif typography for actual document and work content (work should read like a professional artifact)
- Clean, minimal, professional, document/work-oriented
- No gradients
- No chatbot sparkle or generic SaaS dashboard aesthetic
- No unnecessary visual noise

The goal is for generated work to feel like a real professional artifact, not a chatbot response.

## Home / Library

**Home** represents the user's threads and work — persistent deals, active work, recent activity, and open items. It is not a CRM pipeline.

**Library** replaces the previous "Vault" terminology (`/library`; `/vault` redirects to `/library` for backwards compatibility). Library holds useful persistent work and resources such as:

- Deals
- Documents
- Templates
- Relevant knowledge and material
- Work history and activity where appropriate

Do not introduce:

- Lead stages
- Sales funnels
- Lead scoring
- Territory management
- CRM pipelines or generic sales dashboards

## Work Execution Model

The intended product and workflow model is:

**Objective → Plan + Cost → Human Approval → Execute → Observe → Adapt/Continue → Human Gate when needed → Work Product → Audit Trail**

This is a **product/workflow model**, not permission to build a generic autonomous-agent framework. The architecture remains bounded around Dealenz's actual capabilities.

Dealenz moves from:

> "Tell me what this contract means."

toward:

> "Help me prepare this deal."

where appropriate.

Before large or expensive work:
1. Dealenz determines the required steps.
2. It presents the plan.
3. It shows the expected credit cost.
4. The user approves.
5. Execution begins.
6. Progress and results can be observed.
7. Dealenz can determine whether another bounded step is needed.
8. Consequential actions require explicit human approval.

There is no unlimited autonomy. Execution is bounded, explainable, and always gated by the user for consequential actions.

## Single Classifier / Brain

A message is classified into the appropriate category, such as:

- greeting
- question
- real deal content
- command / action

The classifier determines what treatment the message receives (fast-path greeting, routed Ask, deal creation, proposal preparation, etc.). Classification is centralized in `src/lib/conversation/classify.ts` (`isGreeting`, `classifyOperation`, `inferIntent`) and reused by `src/lib/conversation/request.ts` and the `Composer`.

Do not create multiple competing message routers. Do not introduce a second conversational dispatch architecture. The existing canonical pipeline (conversation store → context → knowledge → rules → synthesis → credit boundary) remains the foundation.

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

## Credit Approval

Before Dealenz performs substantial or expensive multi-step work, it shows the user what it intends to do and the expected credit cost, then waits for approval.

Credits remain tied to actual workload and output (risk analysis, drafting, research, protection generation) rather than exposing internal token or provider mechanics. The existing credit system (`src/lib/credits/policy.ts`, `src/lib/credits/ledger.ts`, `src/lib/billing/catalog.ts`) is not redesigned in this phase; the requirement is product-facing approval and transparent cost, not a new billing model.

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

Minimal international purchase is implemented: provider-independent catalog (`src/lib/billing/catalog.ts`, starter/standard/pro in USD/GBP/EUR), Paddle Billing checkout + HMAC-verified webhook (`src/app/api/billing/*`), idempotent allocation through the existing ledger (`credit_purchases` `00037`, no second ledger). Paddle is the Merchant of Record and the sole software billing provider, so no tax engine is implemented. Lemon Squeezy rows (`00043`) are retained as historical data only — not the live provider. Prices are provisional configuration, not approved commercial pricing; no subscriptions and no refunds automation yet. Live Paddle price IDs and `PADDLE_WEBHOOK_SECRET` are required production configuration (see `.env.example` and `VERCEL_ENV_TEMPLATE.md`).

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

## Evidence / Clickable Findings

Every meaningful risk finding must be traceable to its source.

**Product requirement:** Click a finding → jump directly to the exact relevant text and location in the source document.

The architecture connects this to the existing evidence model rather than inventing a parallel system:

- `EXACT` — offset-proven, verified at display time against `raw_input` via `src/lib/verticals/observe.ts` and `src/lib/evidence/inspect.ts`
- `APPROXIMATE` — source-identified but without proven offsets (non-inspectable sources, other sections)
- `UNAVAILABLE` — no location claim

Evidence is preserved as `Evidence` references (`src/lib/evidence/schema.ts`: source type, source id/version, location kind, quote, observation key, method, confidence, inspectable flag) embedded in `Finding.evidence` and collected via `attachEvidence` (`src/lib/evidence/collect.ts`). Findings remain the authority; evidence and interpretation are not conflated.

**Status:** Architectural requirement and partial implementation. Deterministic evidence classification (`EXACT/APPROXIMATE/UNAVAILABLE`) and the inspection verifier are implemented (Phases 7-9); the workspace `FindingsPanel` exposes Inspect-source actions via `src/app/audit/[id]/evidence-actions.ts`. Full click-to-highlight UX that jumps to the exact source span is part of the complete product (to be built) — do not claim it is complete before it is.

## Assumption / Inference Review Before Consequences

Before Dealenz sends or commits something consequential — such as a proposal, external communication, or document shared with a counterparty — it must:

1. Expose the assumptions and inferences it used.
2. Let the user review them.
3. Wait for approval before the consequential action occurs.

This is a trust requirement. The architecture preserves provenance as:

- **Known** — user-confirmed or directly observed
- **Inferred** — derived by AI or context inference
- **Missing** — explicitly unknown and surfaced as such

Existing primitives already support this: `ContextEnvelope` field `source` (`unknown` / `inferred` / `user_confirmed`) and confidence (`src/lib/context/schema.ts`), `variables` with `UNKNOWN` preservation in `src/lib/protection/clauses.ts` (`renderClauseTemplate` keeps `{{var}}`), and `ProtectionIntent.status` / `missing` handling. No parallel provenance system is introduced.

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

Dealenz recommends lawyer review **only when BOTH are true**:

1. The deal is genuinely high-value or high-consequence, **AND**
2. There is a real risky pattern requiring professional attention.

Examples of qualifying patterns:
- Uncapped liability
- Broad indemnity without cap
- Material assignment or change-of-control consequences
- Other materially consequential legal risk surfaced by deterministic findings

Dealenz does NOT recommend a lawyer merely because of the deal type (founder, lease, purchase, etc.). If neither condition holds, the recommendation is honestly absent. The decision is explainable and evidence-based, surfaced through `src/lib/lawyer/trigger.ts` (`shouldRecommendLawyerReview`).

The user can request lawyer review at any time regardless of Dealenz's recommendation. The system never makes an unqualified legal determination such as "You don't need a lawyer." Prefer qualified language: "Based on the factors Dealenz can assess, professional review does not appear necessary."

Conversely, Dealenz handles straightforward deals without forcing professional review. When material complexity, significant exposure, unresolved uncertainty, or unusual provisions exist, the option is offered — not imposed.

## Lawyer Revenue Model

Dealenz receives revenue from professional-review services while maintaining ownership of the customer/deal experience. Do not design a lawyer marketplace.

Money boundary (implemented): Dealenz software/credits run on **Paddle**; lawyer professional services are recorded as service orders (`service_orders`, migration `00044`) and never touch the credit ledger. Credits cannot become money and money never becomes credits.

## Lawyer Payment Boundary

Dealenz does not hold lawyer professional-service payment money. The intended model (part of complete product) is:

- Lawyer connects their own **Stripe** or **Paystack** account (jurisdiction-dependent)
- Client pays through the lawyer's connected payment account
- Lawyer receives the payment directly
- Dealenz automatically takes its agreed platform cut

This is the professional-service payment boundary for the complete product, separate from software billing. The software billing provider remains **Paddle** (`src/lib/billing/provider.ts`, `@paddle/paddle-node-sdk`, `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET`). Do not introduce dual software billing providers. Do not confuse software/credit billing with lawyer-service payments. `Paystack` was the earlier planned rail for lawyer-service payments; `Stripe` is now also supported — payout integration and quoted/paid/fulfilled order states and all payout/fee/tax/escrow rules are to be built as part of the complete product.

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

## Signatures

The intended signing model is:

1. Dealenz prepares the document.
2. The owner/user signs first.
3. It is sent to the counterparty.
4. The counterparty signs.
5. Once fully signed, the document is locked.
6. It cannot simply be edited in place.
7. Changes require a new version or redraft.

This is a product and architecture requirement. The current implementation provides document versioning (`document_versions`, `00012`, `00048` execution-locked final pointer), share tokens (`share_tokens` + `document_signatures`, `00013`), and token-gated signing flows (`src/app/api/document/[auditId]/sign-owner`, `/invite`, `/send`, `src/lib/review/transitions.ts`), but the full owner-first → counterparty → locked → new-version lifecycle is not yet complete in UX — do not claim it is finished.

## Signed-Deal Monitoring

Once a deal is fully signed, Dealenz monitors for important events such as:

- Renewal dates
- Deadlines
- Material contractual events
- Other agreed monitoring conditions

It should alert the user **before** those events matter. **Email is a required delivery mechanism** for this capability.

Part of the complete product — monitoring for renewal/deadline/material events with email alerts, evidence and audit trail, and human gates for consequential actions. Builds on `system_logs`/`activity_events`/`document_versions` primitives.

## Auditability

The architecture must support auditable work. For substantial work, Dealenz should be able to preserve enough information to understand:

- What objective was given
- What plan was proposed
- What the user approved
- What operations were executed
- What evidence was used
- What assumptions and inferences were made
- What outputs were generated
- What consequential actions were approved
- What happened afterward

Use existing primitives where possible (`activity_events`, `system_logs`, `audits.structured_data` with `deterministicFindings` and `handoff_snapshot`, `conversation_messages`, `document_versions`, `credit_ledger`). Do not invent a generic agent trace system unless the repository proves one is required. The goal is **bounded, explainable, auditable deal work**.

## Agentic Direction Without Overbuilding

Dealenz is moving beyond single-turn prompt/response behavior. The intended model is:

**User objective**
→ **Dealenz plans**
→ **user approves expensive work**
→ **Dealenz executes bounded capabilities**
→ **Dealenz observes results**
→ **Dealenz continues/adapts where appropriate**
→ **human approval for consequential actions**
→ **real work product**
→ **auditability**
→ **monitoring**

This does **NOT** mean:

- Autonomous general-purpose agent
- Unrestricted tool use
- Self-directed business decisions
- Hidden actions
- Silent external communication
- Generic agent marketplace
- Generic workflow builder

Dealenz remains a **deal intelligence and protection product** — not a generic agent platform. Execution is bounded around actual capabilities: intake, extraction, context resolution, knowledge resolution, deterministic rules, findings and evidence, negotiation synthesis, drafting and protection, lawyer handoff, signing, and monitoring.

## Proposal / Outreach Workflow Without Turning Dealenz Into a CRM

The following is an **example of bounded work execution** — not a directive to build a CRM.

Example: user provides business/service context, a spreadsheet of prospective contacts, relevant supporting information, and optionally a connected Gmail account.

Dealenz will (as part of complete product):

1. Validate the supplied rows
2. Determine which entries have sufficient information
3. Understand the supplied business and context
4. Personalize a proposal per viable entry
5. Generate the proposal and outreach material
6. Show assumptions and inferred information
7. Allow batch approval
8. Send through the user's connected Gmail **after approval**
9. Report sent/failed results
10. Bring relevant responses back into the appropriate work/deal context

But:

> **The spreadsheet is an input to a work request, not a permanent CRM database.**

Dealenz must not become responsible for:

- Lead management
- Sales stages
- Contact databases
- Sales funnels
- Lead scoring
- Pipeline management
- Territory management
- CRM reporting

The center of gravity remains the deal and work being performed, not a contact database.

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

The product extends beyond signing as part of the complete product.

The Execution layer supports (to be built):
- Signed deal state
- Obligations, deadlines, milestones, payments, deliverables
- Changes/change orders, amendments
- Renewals, disputes/escalation
- Monitoring
- Relationship/deal history

Part of complete product — not yet implemented in current repository, to be built across upcoming phases. Do not claim it exists before it does.

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

Implemented provider: Paddle Billing (transaction-driven checkout via `@paddle/paddle-node-sdk`, custom_data user binding, `Paddle-Signature` HMAC webhook for `transaction.completed`/`transaction.paid`; `credit_purchases` accepts `stripe` (historical), `lemonsqueezy` (historical), and `paddle` (live production path). Stripe was an earlier incorrect implementation and is removed from the live path; Paystack and other providers are not implemented for software billing.)

Evaluation criteria (international-first): international coverage, subscription support, credit purchases, one-time/recurring purchases, currencies, payout availability for a Nigeria-based company, Merchant of Record capabilities, tax/compliance burden, refunds, chargebacks, billing flexibility, professional-service compatibility, long-term scalability.

## Software Payments vs Professional Services

```text
Dealenz Software
      ↓
SaaS / Credit consumption
      ↓
Payment provider (Paddle)

Professional Review
      ↓
Managed professional service
      ↓
Lawyer-connected Stripe/Paystack (future) + platform cut
```

Do not assume one payment provider handles every transaction. Payment-provider policies may treat software/SaaS differently from professional legal services. Software uses Paddle. Lawyer-service payments use the lawyer's own connected account with an automatic platform cut — not a second software billing provider.

## Trust & Governance

Policies are product/architecture requirements, not merely footer links.

Eventual needs: Privacy Policy, Terms of Service, Cookie Policy, Acceptable Use Policy, AI/automated-analysis disclosure, legal disclaimer/scope-of-service disclosure, data retention/deletion policy, refund/cancellation policy, professional legal-service terms where applicable.

The architecture must account for policy-controlled behavior. Do not write legal documents now. Do not invent legal language.

## Data Governance

Unresolved questions requiring future product, legal, security, or provider decisions:

- Are uploaded documents stored? For how long?
- Are extracted facts retained? Generated documents retained?
- Is unauthenticated product access offered? No. Dealenz is authenticated-only. No anonymous analysis, no public low-cost mode.
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

## Known Fidelity Gap

Conflicting material terms can currently collapse into a single extracted string before the rules layer sees them. Example: "payment due 14 days after invoice" vs "30 days after receiving completed work" may be generalized away at extraction (`src/lib/ai/extract.ts` single-string `budget`/`timeline`), so deterministic rules never observe the conflict and payment risk can read low/clear over contradicted input. This is an unresolved authenticated extraction fidelity issue documented in Phase 22C. Do not let the new work-execution architecture obscure it. Fix belongs in a focused extraction-fidelity phase, not bundled with general agentic work.

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
- **Landing page**: Marketing landing page directing visitors to the authenticated workspace (no anonymous analysis mode).
- **Authentication**: Supabase Auth (email/password + Google OAuth with explicit account linking), email verification required
- **Database**: Supabase/Postgres with RLS on all tables, 56 forward migrations (`00056` work execution core: `work_plans`/`work_plan_steps`/`work_approvals`/`work_executions`/`work_products` with RLS, plus `00055` billing service-role grants) plus 3 remediation drafts
- **AI Provider Layer**: Provider-agnostic interface with Gemini, OpenAI-compatible, and Anthropic Claude adapters; authenticated surface on Claude Sonnet 5 with Opus 5 fallback
- **Risk Engine**: 8 freelance categories (scope, payment, timeline, communication, revision, legal, IP, client behavior) with deterministic rules + AI fallback
- **Document Generation**: Proposal → SOW → Contract → Checklist (sequential AI calls with template fallback)
- **Lawyer Handoff**: Contextual Founder/Partnership “Have a lawyer review this deal” CTA after protection/document, `LawyerHandoffReview` panel showing what will be shared (deal type/jurisdiction, critical findings, protection intents, evidence, legal citations/provenance, draft + missing `{{var}}`, honest limitations), submits via existing `consultation_requests` with `handoff_snapshot` `00036` (preserves evidence/VERIFIED…NOT_FOUND, jurisdiction explicit, no Nigeria leak, structure-aware), waitlist vs requested based on verified lawyers
- **Frontend**: Chat-first with work-first split-pane — `ChatThread` (`src/components/chat/ChatThread.tsx`) uses `SplitPane` (`src/components/split-pane`) to render chat/control and work/output side-by-side on desktop (work wider), single-column cards on mobile; sidebar is Home + Library (`/library`, Vault redirects), account menu holds Settings/Billing/Help/Log out
- **Classifier**: Central `src/lib/conversation/classify.ts` (`isGreeting`, `classifyOperation` → `proposal/negotiation/drafting/comparison/decision_support/explanation/document_analysis/conversation`, `inferIntent`) drives Composer routing and cost estimation
- **Evidence**: `EXACT/APPROXIMATE/UNAVAILABLE` via `src/lib/verticals/observe.ts` + `src/lib/evidence/inspect.ts`; `attachEvidence` on FAIL findings; `FindingsPanel` Inspect-source actions (implemented) — full click-to-highlight is a future UX, not yet implemented
- **Work Execution Core**: `work_plans` + `work_plan_steps` (ordered, bounded, `dependsOn` DAG), `work_approvals` (immutable `payload_hash` + `idempotency_key` + `plan_version` binding), `work_executions` (plan-level `reservation_id` → `credit_ledger`), `work_products` (`artifact_refs` + `snapshot`) — migrations `00056`, sequential executor (`src/lib/work/executor.ts`), `PlanPreview`/`ExecutionProgress` surfaces (`src/components/work/*`), `hash.ts` payload binding, `transitions.ts` state machines, plan-level `estimatedCredits` → single reservation only after approval → finalize `consumed` (implemented, 37 tests)
- **Auth Flow**: Supabase Auth + `src/proxy.ts` as middleware (detected by Next.js 16 by filename convention)

---

## TARGET FULL-PRODUCT ARCHITECTURE (Summary)

Dealenz becomes a **deal intelligence, protection, professional-review, and execution platform** with:

1. **Acquisition** — Landing page directing to authenticated workspace
2. **Identity & Account** — Supabase Auth, email verification, team accounts. One human maps to one canonical account with email/password and Google as identities — Google is linked explicitly, never merged by email comparison.
3. **Deal Intelligence** — Context resolution, extraction, evidence mapping, deterministic risk analysis, AI synthesis
4. **Knowledge** — Structured legal rules, industry practices, deal-type schemas, versioned with provenance
5. **Deal Protection** — Negotiation intelligence, clause library, document generation, lawyer handoff
5. **Human Legal Review** — Structured handoff, lawyer workflow, feedback loop (recommended only when high-value/high-consequence + real risky pattern; user-can-always-request)
6. **Deal Execution** — Obligations, change orders, monitoring, relationship intelligence
7. **Commerce** — Credit-based, provider-agnostic, Paddle for software vs lawyer-connected Stripe/Paystack for services with platform cut
8. **Trust & Governance** — Policies as architecture, data governance, security principles
9. **Work Execution & Agentic Direction** — Bounded **Objective → Plan + Cost → Approval → Execute → Observe → Adapt → Human Gate → Work Product → Audit Trail** with chat as control layer and work as dominant output; not a generic agent.

**AI** is a cross-cutting capability (extraction, classification, context, explanation, drafting, synthesis) — subordinate to the system's authority/evidence/governance model. **AI proposes. It never decides.**

---

## STAGED / PLANNED

| Phase | Focus |
|-------|-------|
| **Current (Phase 2 complete)** | **Business-owner first + International docs + Lawyer handoff + Work-first shell + Execution Core + Protection & Batch Outreach:** Founder + Partnership Tier 1 (8 rules each, Nigeria CAMA/CAC + tier2 US/UK/EU); Protection `Finding → ProtectionIntent → Plan → Cost → Approval → Execution → Document → WorkProduct` via `work_plans` (`protection` objectiveKind, `generate_draft` + provenance, `document_versions` immutable `content_hash` + `work_product` link, `draft→ready_to_send`); Spreadsheet batch `upload→parse→validate→preview→plan→cost→approval→execute` (`parseSpreadsheetCSV`/`validateRows` transient, `validate_rows`/`generate_draft`/`send_email` bounded steps, concurrency 5, stable `rowId` = `planId:vVer:rIdx:hash`); Batch `cost` (valid×1) + `assumptions` + `batch approval` (server `findActivePlanForConversation` deduplication); Gmail OAuth (`gmail_tokens` RLS, server-side `upsertGmailTokens`/`refreshAccessToken`, `sendGmailForRow` idempotent `planId:ver:rowId:send` + `work_plan_steps.result_ref.providerMessageId` reuse + DB unique `work_products(plan_id,execution_id)` + `conversation_messages(executionId)`); Reply observation (`observeReplies` per `threadId`, `reply_detected`/`observation_failed`); `Library`/`Home` grouped by `work_products`; `PlanPreview`/`ExecutionProgress`/`AssumptionReview` in `SplitPane` work surface (desktop `Chat|Work`, mobile inline); Credit `reserve/finalize/void` centralized, `0-credit` for `document_analysis` + `5/day` usage limit, `Ask` 1/3/8, `Paddle` only; Evidence `EXACT` verified offsets via `inspectEvidence` (no fake), `UNKNOWN`≠`PASS/FAIL`; `needs_input`/`rate_limited` resumable via `resumePlan` (same `plan.id`/`version`/`payload_hash`/`executionId`); `Home`/`Library` work-first |
| **Next (Phase 3)** | Full signing lifecycle (`Draft → Owner Review → Owner Signs → Counterparty Signs → Fully Signed/Locked → New Version/Redraft`), signed-version locking (`document_versions` `locked` + `superseded`), new-version behavior, signed-deal monitoring (renewal/deadline/material events + email alerts), lawyer connected payments with platform cut, background execution where required, parallel execution where workflow requires it, international-first knowledge coverage expansion, Proprietary Data Flywheel instrumentation, production security/observability/recovery hardening |
| **Deferred: none** | All intended Dealenz capabilities are now assigned to Current (Phase 1-2 complete) or Next (Phase 3); no `Future` deferred product — only genuine boundaries remain: CRM, generic agent framework, duplicate systems, anonymous analysis, Lemon Squeezy |

---

## OPEN / UNKNOWN

1. **Knowledge sourcing strategy** — Partner with legal publisher? Build in-house with counsel? Crowdsource from lawyers?
2. **Lawyer compensation model** — Per-consultation? Subscription? Revenue share?
3. **Jurisdiction coverage v1** — Explicit supported jurisdictions list needed
4. **Rule representation** — TypeScript functions + Zod schemas vs JSON AST vs custom DSL?
5. **Dependency vulnerabilities** — High-severity issues across Next.js, PostCSS, sharp, transitive packages
6. **CI/CD pipeline** — `.github/workflows/ci.yml` runs typecheck/lint/test/build; no deployment job yet
7. **Backup & recovery** — No stated RPO/RTO; relying on Supabase automated daily backups
8. **Data retention policy** — No stated policy; need decision before real user data
9. **Payment provider economics** — Paddle is the live software provider (Lemon Squeezy historical only); remaining question is payout availability, not provider selection
10. **Professional services payment** — Lawyer-connected Stripe/Paystack + platform cut (future); no integration yet

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
