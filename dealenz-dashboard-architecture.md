# Dealenz — Dashboard Product Architecture & UX Strategy

**Product thesis:** Dealenz is the layer between "a client wants to work with me" and "I'm committed." Every other tool in a freelancer's stack (project management, invoicing, CRM) assumes the deal is already safe. Dealenz is the only one that checks. That single distinction should decide what makes it onto a screen and what doesn't — if a feature doesn't help someone qualify a client, protect their terms, or move faster from brief to signed contract, it's not core, no matter how standard it is in generic SaaS.

A second thing worth stating up front: the brief asks for red as primary brand color *and* a risk-flagging product. Those two things will fight each other if not deliberately separated — covered in detail in the UX Reasoning section, but it shapes the architecture, so it's worth flagging here. Brand red (identity, CTAs) and risk-severity red (alerts) need to be visually distinct colors, or the product will feel like it's shouting "danger" at the user constantly, which undermines the trustworthy, calm positioning the brief asks for.

---

## 1. Full Dashboard Architecture

### Information architecture (full map)

```
Dealenz
├── Home                          (action-oriented dashboard, not analytics)
├── Deals
│   ├── Pipeline (all deals, grouped by stage)
│   └── Deal Workspace (single deal — the core object)
│       ├── Intake
│       ├── Risk Analysis
│       ├── Proposal
│       ├── Scope of Work
│       ├── Contract
│       ├── Deliverables Checklist
│       ├── Active Tracking
│       └── Closed / Outcome
├── Clients
│   └── Client Profile (single client)
│       ├── Overview
│       ├── Deal History
│       ├── Risk Patterns
│       └── Notes
├── Risk Intelligence
│   ├── Your Risk Activity (live, scoped to your own deals)
│   └── Risk Library (static glossary + mitigation playbook)
├── Templates
│   ├── Proposals
│   ├── Scopes of Work
│   ├── Contracts
│   └── Deliverables Checklists
└── Account (avatar menu — not primary nav)
    ├── Settings
    │   ├── Business Profile
    │   ├── Notifications
    │   ├── Integrations
    │   ├── Security
    │   └── Team (agency tier only)
    ├── Billing
    └── Sign out

Global chrome (always present, not part of primary nav):
— Search (⌘K command palette)
— Notifications (bell, badge count)
— Activity (per-deal tab + global feed via account menu)
```

### Main navigation — desktop

Five items, sidebar, nothing more:

**Home · Deals · Clients · Risk Intelligence · Templates**

Why five and not eight: every additional top-level item is a tax on the "where do I find X" instinct. Billing, Settings, and Activity are all real, but they're *low-frequency* — a user opens Settings once a month and Deals fifteen times a day. Frequency, not feature importance, should decide nav placement. Low-frequency, high-importance items (Settings, Billing) live one click away in the account menu instead of competing for sidebar space. This is the single biggest lever for hitting "must not feel overloaded."

Sidebar items get a label and a restrained icon — no badge counts on the sidebar itself (badges live on the bell). A persistent sidebar badge count trains anxiety; a notification bell badge is expected and contained.

### Main navigation — mobile

Bottom tab bar, four destinations + one floating action:

**Home · Deals · Clients · Profile** — with a center **+ New Deal** floating action button, and the notification bell living in the top bar (not a tab — alerts are a glanceable state, not a destination you "go to").

Risk Intelligence and Templates are reachable from within Home, Deals, or the Profile/More sheet, not as standalone tabs. Reasoning: on mobile, the realistic use case is "check status," "approve something," or "look up this client before a call walks in" — not browsing a template library. Mobile nav should be optimized for the three things people actually do on a phone between meetings.

---

## 2. Screen-by-Screen Breakdown

### 2.1 Dashboard Home

**Purpose:** answer one question — *what needs my attention right now* — and let the user act in one tap. Not a stats wall. Nothing on this screen should exist purely to look impressive; everything should be actionable or load-bearing.

**Content, in priority order:**
- **Needs Your Attention** — unresolved risk flags, contracts unsigned past a threshold, proposals awaiting client response, documents expiring. This is the top of the page, always.
- **Risk Alerts** — newly surfaced flags on active deals, severity-coded, one-line plain-language reason, direct link to resolve.
- **Quick Start** — a single prominent "New Deal" action in brand red (the one place full-saturation brand red should dominate the screen). For users with no deals yet, this slot also carries "Try a sample deal."
- **In Progress** — a condensed view of 3–5 most relevant active deals as stage chips, with "View all deals" to the Pipeline. Not a kanban dump on the homepage.
- **Upcoming** — follow-up reminders, contract renewal/expiry dates, scheduled check-ins.
- **Recent Activity** — a light, last-few-events feed, linking to the full Activity Timeline.

**Layout:** mobile — single column, stacked by priority. Desktop — two columns: left (≈60%) carries Needs Attention + Risk Alerts (the urgent, decision-driving content); right (≈40%) carries Quick Start, Upcoming, Recent Activity (the supporting, lower-urgency content). Urgent cards get a visually heavier treatment (solid surface, stronger shadow); FYI cards stay lighter and more glass-like — hierarchy expressed through weight, not color.

**Why users need it:** freelancers don't open a dashboard to admire growth charts; they open it anxious about something specific — did the client respond, is the contract actually signed, did the AI catch something they missed. The homepage should resolve that anxiety in under five seconds or point straight at the thing causing it.

### 2.2 Deal Workspace

This is the core object in the product — everything else supports it. ("Audit workspace" in the brief maps to this: the single-deal record a user works through from first contact to close.)

**Purpose:** one place to walk a deal through every protective stage — intake, risk analysis, proposal, SOW, contract, deliverables, active tracking, close — without losing context.

**Content:** a stage stepper (Intake → Risk Analysis → Proposal → SOW → Contract → Deliverables Checklist → Active → Closed), with the current stage's content in the main panel. Every stage shows: what was generated, what's still a draft vs. finalized, what's been sent and whether the client has viewed/signed it.

**Layout:** desktop — three columns. Left: stage stepper (also acts as deal-level navigation). Center: the working content for the current stage (intake form, generated document draft, contract preview). Right: a contextual panel — risk flags relevant to *this* stage, a client snapshot pulled from the Client Profile (so the user never has to leave the deal to remember who they're dealing with), and AI suggestions. Mobile: stepper collapses to a horizontal swipeable strip at the top; the right panel becomes a pull-up sheet; primary actions (Sign, Send, Download) pin to a sticky bottom bar within thumb reach.

**Why users need it:** this is where "avoid getting burned" actually happens. Scattering intake, risk analysis, and document generation across separate flat pages would force the user to mentally reassemble the deal each time. A single stage-based workspace keeps the whole story — and every protection generated from it — in one continuous place.

One workspace detail worth calling out: the **Deliverables Checklist** shouldn't be a document that's generated once and forgotten. During Active Tracking, each client request can be marked in-scope / out-of-scope / change-order directly against the checklist. That turns a static document into the actual scope-creep guard the brief asks for — the product keeps working after the contract is signed, not just up to it.

### 2.3 Client Profile System

**Purpose:** accumulate real intelligence about a client across every deal you've ever done with them — this is what separates Dealenz from a one-off contract generator and is arguably the long-term moat.

**Content:** identity (company, contact, industry), full deal history with outcomes, a set of **trust indicators** — qualitative tags backed by data the user actually logged, never invented: "Reliable payer," "Scope-creep history (2 of 3 deals)," "New client — no history yet." For a brand-new client with no history, the panel shows general red-flag base rates for that client type/industry instead of a fabricated personal score — honest about what is and isn't known yet.

**Layout:** profile header (name, company, initials avatar — no stock photography), then tabs: Overview, Deal History, Risk Patterns, Notes.

**Why users need it:** "poor client qualification" is one of the named pain points, and qualification only gets better with memory. The first deal with a client is a guess; the third deal with the same client should be informed by the first two. This is also the natural answer to "missed client red flags" for repeat clients and referrals — Dealenz should never let a user forget what it already learned.

### 2.4 Risk Intelligence

This is a global area, distinct from the per-deal risk panel inside the Deal Workspace — worth being explicit about the difference so the two don't end up duplicating each other:

- **Per-deal risk panel** (inside Deal Workspace): flags specific to *this* deal, stage-relevant, action-oriented.
- **Risk Intelligence** (global): two tabs —
  - **Your Risk Activity** — every flag ever raised across all your deals, filterable by client, severity, category, resolved/unresolved. Pattern visibility over time ("I keep getting flagged for vague payment terms").
  - **Risk Library** — a standing, always-populated glossary of common red-flag patterns (unlimited revision clauses, net-90 payment terms, broad work-for-hire IP assignment, vague scope language) with plain-language explanations and mitigation suggestions. This exists independent of whether the user has any deals yet.

**Layout:** tab switcher at top; Your Risk Activity as a filterable list with severity chips; Risk Library as a browsable, searchable glossary with category groupings and a preview pane per entry.

**Why users need it:** the per-deal panel answers "what's wrong with *this* deal." The global area answers "what do I keep getting wrong" and "what should I know before I've even been burned once." Folding the Risk Library in here also solves a structural problem — see Empty States below — by guaranteeing this section is never blank, even for day-one users.

### 2.5 Template Library

**Purpose:** speed — directly addresses "slow proposal creation" and "administrative work eating billable time."

**Content:** proposal, SOW, contract, and checklist templates, organized by deal type/industry. Two tiers: Dealenz-provided templates (marked as vetted against common risk patterns — a trust signal in itself) and the user's own saved/customized templates.

**Layout:** grid/list toggle, filters by document type and industry, preview pane on selection. Critically, "Use Template" doesn't drop the user into a dead library page — it creates the document directly inside the relevant stage of an active (or new) Deal Workspace, so the library always feeds into real work rather than sitting beside it.

**Why users need it:** every minute spent rebuilding a proposal from scratch is unbilled time. A vetted starting point also reduces the chance of a user accidentally shipping a bad clause out of haste.

### 2.6 Billing

**Purpose:** manage the Dealenz subscription. Nothing more — this is not client invoicing or payment collection (that's a plausible future feature, covered in Section 7, but conflating "billing for this app" with "getting paid by your client" would confuse two very different jobs).

**Content:** current plan, usage against any metered limits (e.g., AI documents generated this billing cycle — a real number, not a vanity one, only shown if the plan is actually usage-capped), payment method, invoice history, upgrade/downgrade.

**Layout:** simple single-column settings-style page, reached via account menu, not primary nav.

### 2.7 Settings

**Purpose:** configure the business identity that gets stamped into every generated document, plus account-level preferences.

**Content:**
- **Business Profile** — legal business name, entity type, address, default payment terms, logo/signature, standard rate, currency. This is the highest-leverage settings page in the product: get it wrong once and every document generated afterward inherits the mistake.
- **Notifications** — granular controls (risk alerts vs. deal updates vs. product announcements), separately for in-app, email, push.
- **Integrations** — calendar, e-signature, storage (future: payment/escrow).
- **Security** — password, 2FA, active sessions.
- **Team** — agency tier only: seats, roles (owner/member), who can send a contract vs. who can only draft one.

**Layout:** left-hand settings sub-nav, single-column content area per section — standard, and intentionally unremarkable. Settings is not a place to be clever; it's a place to be fast and clear.

### 2.8 Notifications

**Purpose:** surface time-sensitive events without forcing a dedicated page visit for most of them.

**Content:** a drawer/panel (not a primary page) opened from the bell, with tabs — All / Risk Alerts / Deal Updates. Each notification links straight to the relevant deal, document, or client. Read/unread state, mark-all-read, and a link to Notification settings at the bottom.

**Why a drawer and not a page:** notifications are interruptions, not destinations. A full page implies "browse your notifications," which isn't the job — the job is "show me what changed, let me act, get out of the way."

### 2.9 Search

**Purpose:** find anything — a deal, a client, a template, a specific document — in under two seconds.

**Content:** a ⌘K command palette, results grouped by type (Deals, Clients, Templates, Documents), recent searches surfaced when the field is empty. Power-user command mode for direct actions ("New Deal," "Go to Settings") sits naturally alongside search results rather than as a separate feature.

**Why users need it:** as deal volume grows, "scroll the pipeline to find the client" stops working. Keyboard-first global search is also one of the cheapest ways to make a product feel fast and premium — it's a strong, low-cost signal of craft (Spotlight-like, in line with the SF Pro / Apple-adjacent design language).

### 2.10 Activity Timeline

**Purpose:** this is not a nice-to-have feed — for a product whose mission is legal/financial protection, a timestamped, hard-to-dispute record of what happened and when is part of the actual value proposition, not a UI afterthought.

**Content, two scopes:**
- **Per-deal timeline** (a tab inside the Deal Workspace): every stage change, every document generated/edited/sent, every client view, every signature — each with a timestamp.
- **Global timeline** (reached via account menu): the same events across every deal, filterable by client, deal, or event type.

**Layout:** vertical chronological list, grouped by date, icon per event type, no decoration beyond what's needed to scan quickly.

**Why users need it:** "missed client red flags" and "legal exposure" are both, in part, memory problems — what was actually agreed, and when. A clean, immutable-feeling activity trail is the quiet infrastructure underneath the whole "protection" promise; it should feel as trustworthy as the contracts themselves.

### 2.11 Empty States

Cross-cutting, but important enough to call out as its own design surface given the brief's explicit "strong empty states" requirement.

**Strategy, in order:**
1. **Educate** — explain what will live here and why it matters, in one or two plain sentences.
2. **Offer the smallest possible next action** — one button, not three.
3. **Pre-populate with something real wherever possible**, rather than leaving a blank box.

**Concrete examples:**
- **Deals (zero state):** "Your first deal starts here. Paste a client brief, even a messy one — Dealenz will flag what's risky before you reply." → primary action: New Deal. Secondary: "Try a sample deal" (a fully worked, clearly-labeled demo deal a new user can explore without entering real data).
- **Clients (zero state):** "Client profiles build themselves as you run deals — there's nothing to set up." → primary action: New Deal (the explanation that this *isn't broken*, it just hasn't been earned yet, matters as much as the CTA).
- **Risk Intelligence (zero state):** never actually empty — Your Risk Activity shows "No flags yet — here's what to watch for" and falls through directly into the Risk Library, so day-one users get real value from this section before they've run a single deal.
- **Activity (zero state):** "Nothing's happened yet. Once you start a deal, every step gets logged here automatically — useful if a client ever disputes what was agreed." (Stating *why* the timeline matters here, since the value isn't obvious until it's needed.)

### 2.12 Mobile Navigation

Covered in Section 1, restated with screen-level detail: bottom tab bar (Home, Deals, Clients, Profile) plus a center floating "+ New Deal" action and a top-bar notification bell. Inside a Deal Workspace, the stage stepper becomes a horizontal swipeable strip rather than a sidebar, the contextual risk/client panel becomes a pull-up sheet, and primary actions (Sign, Send, Download) pin to a sticky bottom action bar so they stay in thumb reach regardless of scroll position. Document reading views are full-bleed and scroll-optimized — no desktop-style multi-column squeeze.

---

## 3. Premium Interaction Design

A few specific, implementable ideas rather than a generic "add micro-interactions" note:

- **Reserve full-saturation brand red for identity and primary action only** — the logo, the primary CTA, active-state accents. It should never appear as general UI chrome. This is what lets red feel premium instead of alarming, and it's what protects risk-severity color from being drowned out by brand color (see Section 6).
- **Risk flags reveal deliberately, not instantly.** When a flag surfaces, give it a brief, weighted moment — an unfurl, not a chirp — paired with a one-line plain-language reason. This is the exact moment the product proves its value; it shouldn't look like a generic form-validation error.
- **Document generation shows its work.** Rather than an instant pop-in, a brief visible "drafting" sequence (sections appearing in order) signals craftsmanship and gives the user a second to trust what's about to appear, rather than feeling like a black box spat something out.
- **Treat signing as a ceremony, not a checkbox.** A distinct, calmer screen for the actual sign-off moment — given how legally significant it is, the UI should momentarily slow down rather than rushing to the next stage.
- **Glassmorphism used sparingly, on surfaces that need to feel "above" the page** (modals, contextual panels, the stage stepper) — not on every card. Overused blur is exactly the kind of visual noise the brief explicitly wants avoided, and it also hurts legibility for legal text, which this product has a lot of.
- **Tabular figures everywhere numbers appear** (dates, amounts, deal counts) so columns align — a small craft detail that reads as "built by people who care," consistent with SF Pro's design intent.

---

## 4. User Flows

### Flow A — Onboarding to first protected deal (the core "aha" moment)

1. **Account setup** — name, business entity, role type (freelancer / consultant / auditor / agency). Role type tailors which templates and risk patterns are prioritized later.
2. **Skip-friendly business profile** — just enough to populate documents (legal name, rate, currency); everything else deferred to Settings.
3. **Straight into a deal** — no dead-end "welcome" screens. The user either pastes a real client brief or taps "Try a sample deal." Either way, they reach Risk Analysis within roughly two minutes of signing up.
4. **First risk flags appear** — this is the activation moment. The product needs to prove value here, fast, before asking for anything else.
5. **From there, normal deal flow** — proposal, SOW, contract, send.

### Flow B — Mid-engagement scope creep (post-signature, the ongoing protection loop)

1. Client requests something during an active engagement.
2. User checks it against the Deliverables Checklist inside Active Tracking.
3. If out-of-scope, one tap flags it as a change order.
4. Dealenz generates a short addendum from template, pre-filled with the original contract's terms.
5. Addendum sent through the same client-facing flow as the original contract — the protection mechanism is consistent throughout the relationship, not just at the start.

### Flow C — Returning client (client intelligence in action)

1. User starts a new deal and tags an existing client.
2. Intake step automatically surfaces that client's Risk Patterns from their profile ("Late payment on 1 of 2 past deals — consider a deposit clause").
3. Risk Analysis defaults adjust accordingly — this is where the Client Profile system pays off, turning accumulated history into a smarter first-pass analysis instead of treating every deal as a blank slate.

---

## 5. Missing / Forgotten Features

Grouped by how much their absence would undercut the core promise.

**Critical — the product is incomplete without these:**
- **Client-facing viewing portal.** A branded link the client opens to view/respond to a proposal or contract. Without this, "send" has nowhere real to go — the brief lists generation and PDF export but nothing about what the client actually experiences, and that experience is half the protection (a client viewing and accepting through a tracked link is itself evidence).
- **Signing mechanism.** Even a lightweight click-to-accept with captured timestamp/IP is the minimum bar for a contract product; without it, "contract generation" produces a document, not an agreement.
- **Document versioning.** When a client requests changes to a contract or SOW, the user needs to track what changed without losing the original protective terms.
- **Follow-up reminders.** "Proposal sent, no response in 5 days" — closes the loop on slow-moving deals, which is otherwise a silent failure mode.

**Important — expected by users, meaningfully weakens the product without them:**
- **Proof of delivery / view tracking** on sent documents (did the client actually open it) — ties directly into the legal-protection mission.
- **Plain-language clause explainers** next to legal contract language — most users aren't lawyers and won't trust terms they don't understand.
- **Multi-currency support** — freelancers and consultants routinely work with international clients.
- **Duplicate / archive deal and template** — users will want to reuse a past deal's structure without losing the original record.
- **Full data export** — builds trust and removes lock-in fear, which matters more for a product holding someone's contracts than almost any other category.

**Nice-to-have — strengthens the product, not load-bearing at launch:**
- Multiple business entities/personas for users who operate under more than one legal name or in more than one jurisdiction.
- Account recovery / backup messaging specifically reassuring users their signed legal documents are safe — given what's stored here, this is worth surfacing explicitly rather than assuming generic account security copy covers it.

---

## 6. UX Reasoning

**Color strategy — the central tension to resolve.** A red-branded, risk-flagging product is a genuine design problem if not handled deliberately: if brand red and alert red are the same color, every screen with a risk flag also looks like the brand is panicking, and every primary button looks like a warning. Recommended resolution: brand red is a deep, desaturated tone (oxblood/garnet — reads as premium and confident, not alarm-system red) used only for identity and primary actions. Risk severity uses an adjacent but clearly distinct system — amber for caution, a brighter, more saturated red reserved *only* for Critical flags, neutral gray-blue for informational/Low. The two palettes should never be the same hex value. This is the single highest-leverage design decision in the whole system — get it wrong and "trustworthy" becomes "anxious."

**Glassmorphism as restraint, not decoration.** Used on surfaces that need to feel layered above the base page — modals, the contextual panel in Deal Workspace, the command palette — and nowhere else. This product handles a lot of dense legal text; blur and translucency are the enemy of legibility, so the rule should be "glass on chrome, never on content."

**Hierarchy through weight, not noise.** Strong hierarchy doesn't mean more visual elements competing for attention — it means fewer elements with a clearer order of importance (see Dashboard Home's urgent-vs-FYI card treatment). Every screen should have one obvious "if you only look at one thing" element.

**Trust-by-design.** The product is asking users to trust it with the moment they're most anxious about — taking on a new client. That means the product itself has to behave the way it's asking the client relationship to behave: consistent, timestamped, never ambiguous about state (draft vs. sent vs. viewed vs. signed should always be visually unmistakable). The Activity Timeline isn't a feature bolted on for completeness — it's the proof that the product practices what it sells.

**Mobile-first is a usage-pattern argument, not just a technical one.** The realistic mobile moment is checking a deal's status walking into a client meeting, or approving a document between calls — not composing a contract from scratch on a phone. Mobile screens should be optimized for fast status checks and one-tap approvals; heavier composition work (intake, document review) can assume a slightly more patient desktop context without the mobile experience feeling like an afterthought.

**Voice and microcopy.** Plain, direct, specific language over generic SaaS phrasing — "Late payment on 1 of 2 past deals" instead of "Risk Score: 67." This matters doubly here: vague AI-generated-sounding copy is exactly what undermines "must not feel like generic AI SaaS," and it's also just less useful — a user can act on a specific observation, not on an abstract score.

---

## 7. Future Scalability

- **Agency/team mode** — seats, roles, and an approval step before a contract can be sent (the natural extension once Dealenz has multiple users per workspace).
- **E-signature and payment/escrow integrations** — turns "payment risk" from a flagged warning into an actual mitigation (deposit collection, milestone-based escrow) rather than just advice.
- **Calendar/email integration** — auto-detect deal-related correspondence and feed it into Client Profile history without manual logging.
- **AI negotiation assistant** — when a client pushes back on a term, suggest a counter that preserves protection while keeping the deal alive.
- **Opt-in aggregate benchmarking** — once there's real, anonymized, consented data across many users, surface things like "deals like this typically include a deposit clause." This should be built carefully and only on genuine aggregate data — never presented as personalized insight until it actually is.
- **Industry-specific risk models** — an auditor's typical red flags (independence conflicts, scope-of-engagement ambiguity) are different from a designer's (unlimited revisions, ownership of source files); the Risk Library and default templates should eventually branch by role type rather than staying one-size-fits-all.
- **Mobile quick-capture** — a short voice memo after a client call, auto-summarized into deal notes and checked against existing risk patterns.
- **API / integration marketplace** — once the core loop is proven, opening Dealenz up to connect with the rest of a freelancer's stack (accounting, project management) rather than trying to become all of it.

---

## 8. Prioritized Recommendations

| Phase | Scope |
|---|---|
| **MVP** | Deal intake, Risk analysis, Proposal/SOW/Contract generation, Deliverables checklist, Risk mitigation suggestions, PDF export, basic Client profiles (history + manual trust tags), action-oriented Dashboard Home, Business Profile settings, global Search, in-app Notifications, per-deal Activity log, strong empty states throughout, onboarding straight into a real or sample deal. |
| **V1** | Client-facing viewing portal, click-to-accept signing with timestamp capture, document versioning, follow-up reminders, Risk Library (global), Template Library expansion + custom templates, full mobile-optimized flows, Billing/subscription management, full data export. |
| **V2** | Agency/team mode with roles and approval workflows, e-signature and calendar/payment integrations, AI negotiation assistant, opt-in benchmarking, API access. |

**The one sequencing note worth flagging explicitly:** ship the client-facing portal and signing mechanism *before* most other V1 items, even though they're not in the original feature list. A proposal or contract that only the freelancer can see isn't yet doing the job — "send" needs somewhere real to land, and that's arguably more load-bearing for the core promise than template library breadth or mobile polish.
