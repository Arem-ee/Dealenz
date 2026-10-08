# Finding F6: Conversion Optimization Elements

**Hypothesis H6:** Conversion optimization requires multiple CTA tiers — Beyond "Get Started" and "Contact Sales," high-converting pages have micro-conversions: demo requests, ROI calculators, template downloads, newsletter signup, free tool access.

**Status:** CONFIRMED with high confidence (triangulated across all 13 competitors + industry reports)

---

## Evidence Summary

### Competitor CTA Tier Analysis

| Competitor | Tier 1 (High Intent) | Tier 2 (Medium Intent) | Tier 3 (Micro-Conversions) | PLG/Self-Serve |
|------------|---------------------|------------------------|---------------------------|----------------|
| **Ironclad** | Request Demo, Schedule Demo | Watch Overview, Watch Video, Learn More (per role) | Download Gartner/Forrester reports | ❌ |
| **Evisort** | Get a Demo | Explore Contract Intelligence | **Test on your own contracts**, Download whitepaper, On-demand demo, Webinar registration | ❌ |
| **ContractPodAi** | Request A Demo (repeated) | Get More Details (per solution) | Blog, Webinars | ❌ |
| **Lexion** | Contact Us (repeated) | See more → (per role/industry) | G2 reviews link, Case study links | ❌ |
| **Sirion** | Request a Demo, Register Now (webinar) | Watch Overview, Learn More (per agent) | Download Gartner report, Sirion University | ❌ |
| **LinkSquares** | Talk to Sales | Explore our Platform | **Legal AI Maturity Matrix**, Ultimate Guide download, Demo video, Demo Library | ❌ |
| **DocuSign** | **Start for Free**, Contact Sales, Buy Now | Explore IAM, Explore CLM, Explore Gen, View Plans | Templates, Deloitte report, Events | ✅ **Start for Free** (full PLG) |
| **PandaDoc** | Request a Demo | Start free 14-day trial | **Start free trial (no CC)**, API sandbox, 1000+ templates, Blog | ✅ **Free trial + API sandbox** |
| **Gong** | Book a demo (repeated) | Get a custom quote, Save your seat (event) | **Start your tour**, Watch 5-min demo, Platform tour | ❌ |
| **Linear** | Talk to sales | Get started, Download, Open app | **Open app** (immediate product), Changelog, Docs | ✅ **Open app / Get started** (PLG) |
| **Vercel** | Get a Demo | Deploy, Start Deploying | **Deploy now** (immediate), Git CLI example, Recently shipped | ✅ **Deploy / Start Deploying** (PLG) |
| **Stripe** | Contact sales, View plans | Start now, Explore no-code, View developer docs | **Start now** (immediate dashboard), GitHub, Atlas (company formation) | ✅ **Start now** (immediate) |

---

## CTA Pattern Classification

### Tier 1: High Intent (Sales-Ready)
- "Request Demo" / "Book a Demo" / "Talk to Sales" / "Contact Sales"
- "Schedule Demo" (specific)
- "Contact Us" (generic)

### Tier 2: Medium Intent (Product Evaluation)
- "Watch Demo" / "Watch Video" / "Watch Overview"
- "Explore Platform" / "Explore [Product]"
- "Get a Custom Quote" / "View Plans"
- "Learn More" (per feature/role)
- "Register Now" (events/webinars)

### Tier 3: Micro-Conversions (Engagement & Education)
- **Interactive assessments** — LinkSquares Maturity Matrix, Stripe Atlas
- **Free tool access** — Evisort "Test on your contracts", Linear "Open app", Vercel "Deploy now"
- **Content downloads** — Guides, whitepapers, reports, buyer's guides
- **Template/template gallery access** — PandaDoc 1000+, DocuSign Templates
- **API sandbox / Developer access** — PandaDoc, Stripe, Vercel, Linear
- **Self-serve trial** — DocuSign, PandaDoc (14-day no CC)
- **Changelog/Velocity signals** — Linear, Vercel
- **Review platform links** — Lexion "See more reviews on G2"

### PLG Tier: Immediate Product Access
- "Start for Free" (DocuSign)
- "Start free trial" (PandaDoc)
- "Open app" / "Get started" (Linear)
- "Deploy now" / "Start Deploying" (Vercel)
- "Start now" (Stripe)

---

## Gap Analysis: Dealenz Current State

| CTA Tier | Dealenz Current | Competitor Standard | Gap |
|----------|-----------------|---------------------|-----|
| Tier 1 (High) | "Get Started Free" → /register, "Sign In to Console" | Request Demo, Book Demo, Talk to Sales | **Wrong CTA** — "Get Started Free" goes to register, not demo; no "Request Demo" |
| Tier 2 (Medium) | "Explore Platform" → #platform anchor | Watch Demo, Explore Platform, View Plans | **Weak** — Anchor link only, no video/tour |
| Tier 3 (Micro) | **None** | 3-5 micro-conversions per competitor | **Critical** — Zero micro-conversions |
| PLG/Self-Serve | "Get Started Free" (registration required) | Immediate product access (Linear, Vercel, Stripe) | **Critical** — Registration gate before value |

### Dealenz Current CTA Inventory
1. **Hero:** "Get Started Free" → `/register` | "Explore Platform" → `#platform`
2. **TrustStrip:** None (capability markers only)
3. **Advantage:** None (tabs only)
4. **Impact:** None
5. **Comparison:** None
6. **Workflows:** None
7. **Industries:** "Read the guide" → `/insights/*` (content link)
8. **ViewPricing:** "View pricing" → `/pricing`
9. **FinalCTA:** "Get Started Free" → `/register` | "Sign In to Console" → `/login`
10. **Footer:** Various navigation links

**Total unique CTAs:** 3 (Register, Login, Pricing, Platform anchor, Insights links)
**Micro-conversions:** 0
**PLG access:** 0 (registration required before any product interaction)

---

## Vezadigital Navigation/CTA Patterns (Source 32)

> "Sticky header with a visible CTA"
> "Anchor links that scroll to sections instead of new pages"
> "Navigation that highlights sections or emphasizes the CTA during scroll"
> "In more complex or enterprise products, removing navigation can reduce trust. A minimal, clear menu works better."

Dealenz has SiteHeader (minimal nav) — **correct for enterprise** — but CTA persistence could be stronger.

---

## Implementation Recommendations for Dealenz

### Must-Have (Priority 1)
1. **Add "Request Demo" as Primary CTA** — Replace "Get Started Free" in hero with "Request Demo" (high intent); keep "Get Started Free" as secondary for PLG-curious
2. **Sticky Header CTA** — Persistent "Request Demo" in SiteHeader (visible on scroll)
3. **Micro-Conversion: "Test on Your Contract"** — Upload → analyze → gate results → capture lead (direct Evisort response)
4. **Micro-Conversion: Interactive Assessment** — "Legal AI Maturity Assessment" (LinkSquares response) → personalized PDF → lead capture
5. **Video Demo CTA** — "Watch 3-min Demo" → modal/video page (Tier 2)

### Should-Have (Priority 2)
6. **Template/Playbook Downloads** — "Download MSA Review Playbook" → gated content → lead capture
7. **ROI Calculator** — "Calculate Your Contract Review Savings" → interactive → email results
8. **Newsletter/Updates Signup** — "Get contract intelligence insights monthly" → low-friction footer/header signup
9. **G2/Review Platform Links** — "Read reviews on G2" (if listed) or "See what customers say" → testimonials page

### Nice-to-Have (Priority 3)
10. **Free Tier / Sandbox Access** — "Try Dealenz Free — 10 credits, no card" → immediate analysis of 1 contract
11. **Changelog/Velocity Signal** — "What's New" in footer/header → signals active development
12. **Exit-Intent Micro-Conversion** — "Not ready for demo? Download our Contract Intelligence Buyer's Guide"
13. **Chat/Widget** — "Questions? Chat with our team" (not bot — human legal ops specialist)

---

## CTA Placement Strategy (Per Vezadigital & Moda)

| Page Section | Current CTA | Recommended CTA Stack |
|--------------|-------------|----------------------|
| Hero | Get Started Free / Explore Platform | **Request Demo** (primary) / **Watch Demo** (secondary) / **Test Your Contract** (micro) |
| Sticky Header | None | **Request Demo** (always visible) |
| Trust/Authority | None | **Download Gartner/Forrester-style Report** (when available) |
| Advantage Tabs | None | **Explore [Tab] Workflow** → deep page |
| Comparison | None | **See Full Comparison** → comparison page |
| Industries | Read the guide | **Download Industry Playbook** (gated) |
| Pricing | View pricing | **View Pricing** / **Calculate ROI** |
| Final CTA | Get Started Free / Sign In | **Request Demo** / **Start Free Analysis** |
| Footer | Navigation | **Newsletter Signup** / **Resource Library** |