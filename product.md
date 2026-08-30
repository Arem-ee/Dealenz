# Dealenz — Product

## Positioning
"Know the risk before you sign."

Anyone entering an agreement — freelance work, a lease, a partnership,
a service contract, a purchase agreement — is exposed to terms they
didn't write and risks they can't easily see. Dealenz reads the deal (a
brief, an email thread, an uploaded contract, a call transcript) and
tells you what's risky before you commit, generating protective
documents where that's the relevant next step.

This is a broadening from the original freelancer-only framing ("audit
your client before you write the proposal"). That framing still
describes the flagship, fully-built use case — but it's now one deal
type among several, not the whole product.

## Who it's for
Broadened from freelancers specifically to anyone about to enter or
already reviewing an agreement: freelancers and consultants (the
original and most complete use case), small business owners signing
vendor/lease/partnership agreements, contractors reviewing client
contracts, and individuals facing any agreement complex enough that
"I should probably read the fine print" is a real thought they had.

Not aimed at large enterprises with existing legal teams — the value is
in giving people who don't have a lawyer on call a clear risk read
before they sign.

## Deal types
This is the concrete thing that has to be built, not just repositioned.
Today the extraction schema, risk categories, and document generation
are all hardcoded to freelancer-client deals. Generalizing means the
product needs to know what kind of deal it's looking at.

| Deal type | Status |
|---|---|
| Freelance / client service work | Fully built — this is the current product |
| General service agreements (non-freelance) | Not built — likely close to freelance type, different vocabulary |
| Lease / rental agreements | Not built — different risk categories entirely (deposit terms, maintenance responsibility, early termination) |
| Purchase / sale agreements | Not built |
| Partnership / investment agreements | Not built — highest complexity, likely last priority |
| Employment / contractor agreements | Not built — adjacent to freelance type but legally distinct |
| Other / custom (user-described) | Not built — a fallback path so the tool never hard-refuses an input it doesn't have a template for |

Open decision: does v1 of the broader tool launch with a small set of
well-supported deal types (freelance plus one or two others), or with a
generic "any deal" mode that's less precise but works on anything? The
generic mode is faster to ship and matches "not client-work specific"
literally, but risks feeling shallow next to the freelance flow's depth.
Recommend starting with a generic audit-only fallback (risk report, no
document generation) alongside the freelance flow kept fully intact —
that way nothing that works today gets worse while the broader promise
becomes true.

## Core loop, generalized
1. **Intake** — paste text, upload a file, or fill a guided form
   describing the deal. New: user (or the AI) identifies which deal type
   this is, since that determines which risk categories and document
   types apply downstream.
2. **Extract** — AI pulls structured data out of the raw input. The
   extraction schema needs to become deal-type-aware rather than
   assuming freelancer fields (scope, budget, timeline) always apply.
3. **Risk analysis** — the deterministic engine scores risk categories
   specific to the deal type. Freelance keeps its current 8 categories;
   other deal types need their own category sets defined before they can
   be scored deterministically rather than just AI-guessed.
4. **Protection package (where relevant)** — for freelance deals, this
   stays proposal/SOW/contract/checklist. For deal types where the user
   is receiving an agreement rather than sending one (a lease, a
   partnership offer), the useful output isn't a new document — it's a
   risk report plus negotiation talking points on the existing terms.
   These are different outputs and shouldn't be forced into the same
   template.
5. **Send & sign** — stays freelance-specific for now; there's no
   generalized "counterparty" concept yet for other deal types.

## Core principle: AI is not the risk engine
This is intentional and worth protecting as the product grows. Gemini
doesn't get to decide "this deal is 72% risky" on its own judgment. The
flow is: raw input → AI extraction → structured deal data → a
deterministic rule engine scores risk categories against that structured
data. AI proposes the facts, the engine decides the risk. This matters
for trust — a user can see why a deal scored high risk by pointing at a
rule, not an opaque model output, and it's why the rule-engine fallback
exists: if the AI call fails, the product still produces a real risk
report instead of nothing. This principle holds regardless of deal type —
each deal type needs its own defined rule set, but none of them should
let the AI assign a score directly.

This loop is real and end-to-end today for the freelance deal type, not
a mockup. Other deal types don't have this built yet — see "Deal types"
above.

## The three layers of the product
Useful framing for scoping any future work — which layer is a given
feature actually serving?

1. **Deal Intelligence** — "Should I take this deal?" The audit and risk
   scoring. This layer is built and working.
2. **Deal Protection** — "If I take it, how do I protect myself?" The
   generated proposal, SOW, contract, and checklist, with risk-conditioned
   terms. Also built and working.
3. **Deal Execution** — "Now that we've agreed, how do we manage it?"
   Client portal, milestones, change requests, deliverables tracking,
   document versioning, billing. This is the layer referred to elsewhere
   in this doc as "protection after send" — it's where the product
   currently stops, and where most of the open scope decisions live.

## The landing page is acquisition, not core app
Worth keeping distinct in planning: the landing page exists to convert
cold traffic into a signed-up user running their first audit. It is not
part of the Intelligence/Protection/Execution stack itself. Traffic →
landing → auth → dashboard → audit flow → Intelligence → Protection →
(eventually) Execution. Don't let landing-page polish compete for
priority against the actual product loop past the acquisition layer.

## What "protection" means beyond the initial send (vision, not yet built)
The pitch implies ongoing protection through the life of the deal, not
just a one-time PDF. Today the product stops at "sent" — this is the
biggest gap between the pitch and the current build:
- No tracking of scope-creep requests against the original agreement
  (in-scope / out-of-scope / change-order) after signature
- No visibility to the freelancer that a client opened the shared link
  (it's logged in the DB but never surfaced in the UI)
- No follow-up nudges when a sent proposal goes quiet
- No addendum/change-order generation when scope shifts mid-project

Deciding whether to build this before wider launch, or ship the
audit→proposal→sign loop alone and add protection-after-send later, is a
scope call — not yet made.

## The moat that isn't built yet: client memory
The long-term differentiation isn't a single audit — it's Dealenz
remembering a client across multiple deals and multiple freelancers'
experiences with the same client (repeat late-payers, repeat
scope-changers). Right now `client_profiles` exists as a table and a
per-user client list, but there's no aggregation of risk patterns over
time and no "Notes" or "Risk Patterns" view. This is currently a stub, not
a moat.

## MVP vs V1 scope (freelance deal type, as currently built)
**Implemented (MVP-complete):** intake (3 modes), extraction, risk
scoring with fallback, proposal/SOW/contract/checklist generation with
risk-conditioned terms, PDF export, share links, e-signing, dashboard,
templates library, auth with email verification.

**Stubbed / preview only:** client intelligence (list view, no pattern
aggregation), billing (shows a free-tier counter, no Stripe, no upgrade
path), notifications (bell exists, "mark all read" has no handler),
search (title-only, no real indexing).

**Missing entirely:** post-signature scope tracking, document version
browsing/diff/restore UI (versions are stored, not exposed), view-proof
surfaced to the freelancer, follow-up reminders, per-clause legal
explainers, and everything under "Deal types" above for any non-freelance
deal.

## Open product decisions
- Ship without client intelligence for v1, or hold launch until repeat-
  client patterns are real? (Currently leaning toward: ship without, since
  the core audit→protect→send loop already proves the pitch on its own.)
- Is billing/Stripe a pre-launch blocker or a post-traction problem?
- How much of "protection after send" is needed before this can be
  called done, versus a fast-follow?
- Which non-freelance deal type ships first, if any, before wider launch
  — or does the generic audit-only fallback cover "not client-work
  specific" well enough for an initial broader release?
- Does broadening the audience change the brand voice/copy? "Client,"
  "proposal," and "freelancer" are used throughout the current UI copy
  and would need genericizing (e.g. "counterparty," "agreement") for
  deal types where those words don't fit.

## Monetization & pricing

### Free tier — landing page as a working mini-dashboard
Anyone can paste or upload a deal on the landing page itself, no
signup, and get a real result. This is the acquisition strategy: prove
the product works before asking for anything. Two decisions this
depends on:

- **Anonymous usage needs its own limit**, separate from the signed-up
  free tier — IP or device-fingerprint based, since an unauthenticated
  endpoint with no cap is a scriptable cost sink. Once that cap is hit,
  the prompt is to create an account to keep going, not to pay yet.
- **Free tier shows a full risk report, not a teaser.** Reasoning: this
  product's core promise is trustworthy risk analysis. A watered-down
  free report undercuts the pitch itself, and this is the same reasoning
  that ruled out degrading AI quality on free vs paid below. Free tier
  limits should be about volume (analyses per day/month) and depth
  (no generated proposal/SOW/contract/checklist, no PDF export, no
  sharing/signing), not about giving free users a worse or less honest
  answer about their risk.

### AI quality stays consistent across tiers
Decided earlier in this conversation and worth restating as a fixed
principle here: the free tier must not run a meaningfully worse model
than paid. Gating by volume and feature depth protects the revenue
motive without putting free users' actual risk assessment at risk —
which matters more for this product than most, since a missed risk on
the free tier is the exact failure the product exists to prevent, and
free users are the ones least equipped to absorb that mistake.

### Card-on-file trial (the "normal" pattern, done compliantly)
Card is collected either at signup or when the free cap is hit, trial
period begins, first real charge happens automatically at trial end
unless cancelled — this is the standard SaaS pattern and it's fine, with
three things that make it compliant rather than a dark pattern (relevant
given the US/UK/EU freelancer audience this product targets, and given
FTC click-to-cancel enforcement and similar EU/UK rules):
- Trial terms and the exact charge date/amount are shown clearly at the
  point the card is collected, not buried in fine print.
- A reminder (email, and ideally an in-app banner) fires before the
  trial converts to a paid charge, with enough lead time to cancel.
- Cancellation is as easy as signup — one click or one clear flow, not a
  support-ticket-only or phone-call-only cancellation path.

### Pricing psychology — what to use, what to avoid
**Use:**
- **Value anchoring** — show the cost of a single bad deal (a missed
  payment clause, a scope dispute, an unenforceable IP clause) next to
  the subscription price. This is honest anchoring, not manufactured:
  it's specifically true for this product that the downside it prevents
  is larger than the subscription cost.
- **Price anchoring on the pricing page itself** — show a higher-priced
  plan or the annual-equivalent monthly rate crossed out next to the
  actual price, and mark one plan "Most popular" or "Best value" to
  anchor the comparison. Standard, not manipulative, as long as the
  crossed-out price is real (e.g. actual monthly-billed price shown
  crossed out next to the annual per-month rate).
- **Commitment/consistency** — once a free-tier user has a real risk
  report sitting in front of them, asking them to create an account to
  keep it is low-friction and non-manipulative, since they've already
  invested the time and have something real to lose by walking away.
- **Contextual upgrade prompts** — nudge toward upgrade at the moment
  it's actually relevant: a usage counter approaching the free cap, or
  directly after a high-risk audit result ("this deal scored high risk —
  upgrade to generate a protection contract with clauses addressing
  what was found"). This converts better than generic upgrade banners
  because it's tied to a real, just-demonstrated need.
- **Real, time-bound discount offers** ("30% off your first three
  months") — fine to use, especially as a retention offer at the point
  someone attempts to cancel. The requirement is that it's real: an
  actual discount, actually honored, not a manufactured "your discount
  expires in 4 minutes" countdown.

**Avoid:**
- Fake urgency or scarcity (countdown timers, "only 2 spots left" on a
  digital product with no real capacity constraint). Beyond being a
  common dark-pattern complaint generally, it's a specifically bad look
  for a product whose brand promise is helping people spot exactly this
  kind of manipulation in the deals they're evaluating.
- Hiding the cancel flow or making it harder than signup — this is the
  compliance issue above, but it's also just inconsistent with the
  brand.
- Any framing that implies a higher-tier plan gives materially better
  risk detection than the free tier — see "AI quality stays consistent"
  above. Upgrade prompts should sell volume, depth, and convenience,
  never "our free version might miss something."

### Open pricing decisions
- Exact price points and tier names — not yet decided.
- Whether the anonymous (pre-signup) free cap and the signed-up free
  cap are the same number or the signed-up tier gets more, as an
  incentive to create an account beyond just "keep your result."
- Whether annual billing is offered at launch or added once monthly
  pricing is validated.
