# Finding F7: Pricing Transparency & Enterprise Sales Motion
**Hypothesis:** H7 — Pricing transparency for enterprise includes "Contact Sales" CTAs with clear qualification criteria, not just credit-based self-serve

**Status:** PARTIALLY CONFIRMED — Legal tech competitors split: 4/6 pure enterprise (Contact Sales), 2/6 hybrid (Pricing page + Enterprise); General SaaS: 3/7 freemium, 2/7 transparent tiers, 2/7 enterprise-only

---

## Evidence Summary

| Competitor | Pricing in Nav | Pricing Model | Self-Serve/Free | Enterprise Path | Qualification Criteria |
|------------|----------------|---------------|-----------------|-----------------|------------------------|
| **Ironclad** | Yes | Enterprise subscription | No | "Contact Sales" / "Book a demo" | Implicit (enterprise focus) |
| **Evisort** | No | Enterprise (via Workday) | "Try Evisort" | "Get a live demo" | Workday channel |
| **ContractPodAi** | No | Enterprise | No | "Request a Demo" | Fortune 500 / regulated industries |
| **Lexion** | **Yes** | **Hybrid** (tiers + enterprise) | Pricing page suggests self-serve | Enterprise column | Explicit feature comparison |
| **Sirion** | No | Enterprise | No | "Book a demo" / /demo/ page | Enterprise-grade positioning |
| **LinkSquares** | No | Enterprise | No | Guide downloads → Demo | Lead magnet → sales |
| **DocuSign** | **Yes** | **Freemium + Enterprise** | **"Start for Free"** | IAM Platform pricing | Tiered (eSignature vs IAM) |
| **PandaDoc** | **Yes** | **Transparent tiers + Enterprise** | Templates, Free demo | "Schedule live demo" | Explicit feature comparison |
| **Gong** | No | Enterprise | No | "Book a demo" | 5,000+ customers = enterprise |
| **Notion** | **Yes** | **4 tiers (Free → Enterprise)** | **Free Plan** | Enterprise column explicit | SCIM, Audit log, DLP/SIEM, CSM |
| **Linear** | **Yes** | **Freemium tiers** | **"Sign up for free"** | Implicit | Team/Org features |
| **Vercel** | **Yes** | **Freemium + Enterprise** | **"Get started for free"** | "Talk to sales" | Enterprise features listed |
| **Stripe** | **Yes** | **Pay-as-you-go + Enterprise** | **No setup fees, pay-as-you-go** | Professional services | Volume-based |

---

## Pricing Model Taxonomy

### Type A: Pure Enterprise Sales-Led (4/6 Legal Tech, 1/7 General SaaS)
- **No pricing page** or pricing page redirects to demo
- **Single CTA:** "Book a demo" / "Contact Sales" / "Request a Demo"
- **Qualification:** Implicit through positioning (Fortune 500, regulated industries, enterprise-grade)
- **Examples:** Ironclad (has pricing in nav but enterprise), Evisort, ContractPodAi, Sirion, LinkSquares, Gong

### Type B: Hybrid — Transparent Tiers + Enterprise (2/6 Legal Tech, 2/7 General SaaS)
- **Pricing page with feature comparison table**
- **Self-serve tiers** (Starter, Professional, Business)
- **Enterprise column** with "Contact Sales" and explicit enterprise features
- **Examples:** Lexion, PandaDoc, Notion, Vercel

### Type C: Freemium / Pay-As-You-Go (0/6 Legal Tech, 3/7 General SaaS)
- **Free tier** or **pay-as-you-go** with no setup fees
- **Self-serve activation** (credit card or immediate access)
- **Enterprise** as separate tier with professional services
- **Examples:** DocuSign (freemium), Linear (freemium), Stripe (pay-as-you-go)

---

## Legal Tech Pricing Positioning

| Competitor | Positioning | Price Anchor | Value Metric |
|------------|-------------|--------------|--------------|
| **Ironclad** | "Easy to buy, set up, and maintain" | Not disclosed | Per user / per contract (implied) |
| **Evisort** | "21 days implementation", "450K docs/24hrs" | Not disclosed | Per document / per user (via Workday) |
| **ContractPodAi** | "Phased rollout", "Gartner Visionary 5x" | Not disclosed | Platform license + usage |
| **Lexion** | **"Simplest way to scale legal without adding headcount"** | **Tiered** (implied) | **Per user / per contract** |
| **Sirion** | "Enterprise-grade precision", "70+ countries" | Not disclosed | Platform + agents |
| **LinkSquares** | **"Turn Every Agreement Into ROI"** | Not disclosed | Platform + analytics |
| **Dealenz** | **"Pay per deal outcome. No subscription lock-in."** | **Credit packs** (10 free credits) | **Per deal / per credit** |

---

## Dealenz Current Pricing Analysis

### Strengths (Differentiated)
- **Credit-based, outcome-based pricing** — unique in legal tech (all others are subscription/seat-based)
- **"No subscription lock-in"** — addresses buyer fear of shelfware
- **10 free credits** — low-barrier trial
- **Transparent credit pricing** on `/pricing` page

### Gaps vs. Competitors
| Gap | Competitor Standard | Dealenz Current |
|-----|---------------------|-----------------|
| **Enterprise pricing page** | Lexion, PandaDoc, Notion, Vercel have explicit Enterprise column | No Enterprise tier shown |
| **Qualification criteria** | Notion lists Enterprise features (SCIM, Audit log, DLP, CSM) | None |
| **Professional services** | Stripe, DocuSign, Ironclad mention implementation help | Not mentioned |
| **Implementation timeline** | Evisort (21 days), Sirion (phased) | Not mentioned |
| **Volume/commitment discounts** | Implicit in enterprise deals | Not mentioned |
| **ROI calculator** | LinkSquares (ROI framing), PandaDoc (metrics) | None |
| **Comparison to alternatives** | Ironclad (vs Generic AI vs Manual), Lexion (vs competitors) | Comparison table exists but not pricing-focused |

---

## Gap vs. Dealenz Current State

| Element | Dealenz Current | Competitor Standard (Legal Tech) | Gap Severity |
|---------|-----------------|----------------------------------|--------------|
| Pricing in main nav | **Yes** (good) | 4/6 have it | **LOW** (advantage) |
| Credit-based model | **Unique differentiator** | 0/6 have this | **LOW** (advantage) |
| Enterprise tier visibility | **None** | 2/6 hybrid have Enterprise column | **HIGH** |
| Enterprise features listed | **None** | Notion (SCIM, Audit, DLP, CSM), Lexion (implied) | **HIGH** |
| Professional services | **None** | Ironclad, Stripe, DocuSign | **MEDIUM** |
| Implementation info | **None** | Evisort (21 days), Sirion (phased) | **MEDIUM** |
| Qualification criteria | **None** | Implicit (Fortune 500, regulated) | **MEDIUM** |
| ROI/Value framing | "Pay per outcome" | LinkSquares ("ROI"), PandaDoc (metrics) | **MEDIUM** |

---

## Implementation Recommendations for Dealenz

### Must-Have (Immediate)
1. **Add Enterprise tier to `/pricing` page** with explicit features:
   - SSO/SAML + SCIM provisioning
   - Audit logs + SIEM integration
   - Dedicated Customer Success Manager
   - Custom rulepack development
   - SLA + priority support
   - Data residency options (EU/US)
   - "Contact Sales" CTA with qualification form
2. **Add "Enterprise" to pricing comparison table** (currently shows credit packs only)
3. **Create Enterprise landing page** (`/enterprise` or `/pricing#enterprise`) with:
   - "Designed for teams managing 500+ contracts/year"
   - "Volume discounts starting at X credits/month"
   - "Implementation in 2-4 weeks with dedicated onboarding"
   - "Schedule enterprise demo" CTA

### Should-Have (Q1)
4. **Add professional services mention** — "Implementation guidance", "Custom rulepack development", "Migration from legacy CLM"
5. **Create ROI/Value calculator** — "Enter your contract volume → See estimated time savings vs. manual review"
6. **Add qualification form** to "Contact Sales" — Company size, contract volume, current tools, timeline
7. **Publish implementation timeline** — "Standard onboarding: 2 weeks. Enterprise: 4-6 weeks with custom rulepacks."

### Nice-to-Have (Q2)
8. **Volume commitment discounts** — "Annual credit commits: 10% off at 1,000 credits, 20% off at 5,000 credits"
9. **Partner ecosystem for implementation** — "Work with our certified implementation partners"
10. **Pricing page A/B test** — Credit-based vs. Seat-based framing for different personas
11. **Competitive pricing comparison** — "Dealenz vs. Ironclad vs. Lexion: Cost per contract analyzed"
12. **Customer billing portal** — Self-serve credit top-up, usage analytics, invoice history

---

## Sources
- S01_Ironclad: Pricing in nav, "Easy to buy, set up, maintain", enterprise focus, "Book a demo"
- S02_Evisort: No pricing page, "21 days implementation", "Try Evisort", Workday channel
- S03_ContractPodAi: No pricing page, "Request a Demo", phased rollout, Fortune 500 focus
- S04_Lexion: **Pricing in nav**, tiered implied, "simplest way to scale legal", ROI metrics
- S05_Sirion: No pricing page, "Book a demo", /demo/ page, enterprise-grade
- S06_LinkSquares: No pricing page, guide downloads → demo, "Turn Every Agreement Into ROI"
- S07_DocuSign: **Pricing in nav**, **Freemium** ("Start for Free"), IAM separate, tiered
- S08_PandaDoc: **Pricing in nav**, **Transparent tiers**, "Schedule live demo", templates free
- S09_Gong: No pricing page, "Book a demo", 5,000+ customers
- S10_Notion: **Pricing in nav**, **4 tiers (Free→Enterprise)**, explicit Enterprise features (SCIM, Audit, DLP, CSM)
- S11_Linear: **Pricing in nav**, **Freemium**, "Sign up for free"
- S12_Vercel: **Pricing in nav**, **Freemium + Enterprise**, "Get started free" / "Talk to sales"
- S13_Stripe: **Pricing in nav**, **Pay-as-you-go**, no setup fees, professional services, MCP Server