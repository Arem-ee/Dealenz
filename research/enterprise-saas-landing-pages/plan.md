# Research Plan: High-Converting Enterprise SaaS Landing Pages (Legal Tech / Contract Intelligence)

## Research Question
What sections, elements, and patterns do top-performing enterprise B2B SaaS landing pages (especially legal tech, contract review, deal intelligence) use that are missing from the current Dealenz landing page?

## Current Dealenz Landing Page Structure
1. **Hero** — Headline, subheadline, dual CTA, product mockup (illustrated example)
2. **TrustStrip** — 6 capability markers (Deterministic Rules, Evidence-Backed Findings, Owner-First Signing, Renewal Monitoring, EU-Hosted·AES-256, SOC 2 Type II In Progress)
3. **Advantage** — 4 tabs (Intake, Risk Audit, Redline, Sign & Track) with interactive mockups
4. **Impact** — Deadline tracking dashboard mockup
5. **Comparison** — 3-column comparison table (Dealenz vs Generic AI vs Manual Review)
6. **Workflows/Globe** — Interactive globe showing feature interconnectedness
7. **Industries** — 4 industry vertical cards linking to insights pages
8. **ViewPricing** — Pay-per-deal pricing band with CTA
9. **FinalCTA** — Dual CTA (Get Started Free / Sign In)

## Target Competitors to Analyze

### Legal Tech / Contract AI (Primary)
- **Ironclad** — Contract lifecycle management (CLM) leader
- **Evisort** — AI-powered contract intelligence
- **ContractPodAi** — End-to-end CLM platform
- **Lexion** — Contract management & analytics
- **Sirion** — Contract lifecycle management
- **LinkSquares** — AI-powered contract analytics

### Adjacent (Doc/Deal Space)
- **DocuSign** — E-signature + agreement cloud
- **PandaDoc** — Document automation + e-signature

### General Enterprise SaaS (Best-in-class patterns)
- **Gong** — Revenue intelligence
- **Notion** — Workspace/productivity
- **Linear** — Issue tracking/project management
- **Vercel** — Frontend cloud platform
- **Stripe** — Payments infrastructure

## Falsifiable Hypotheses

1. **H1: Enterprise buyers expect dedicated social proof sections** — Top legal tech landing pages have explicit testimonial sections, customer logos with headlines, case study links, and quantifiable metrics (ROI, time savings, risk reduction) that Dealenz currently lacks.

2. **H2: Technical credibility signals are non-negotiable for legal tech** — Enterprise buyers require visible SOC 2 Type II badges, compliance certifications (ISO 27001, GDPR), penetration test summaries, and data residency guarantees prominently displayed, not buried in footers.

3. **H3: Interactive product depth demonstrations drive conversions** — High-converting pages include sandbox environments, interactive demos, video walkthroughs, or "try before you buy" experiences that let buyers evaluate the product without sales contact.

4. **H4: Role-based entry points align with buying committee structure** — Enterprise SaaS pages segment content for different buyers (Legal/GC, Procurement, Sales Ops, IT/Security, Finance) with tailored value props, not a single linear narrative.

5. **H5: SEO/content strategy sections serve as trust signals** — Resources hubs (blog, guides, webinars, templates, API docs) signal maturity and thought leadership; their absence signals early-stage/immature product.

6. **H6: Conversion optimization requires multiple CTA tiers** — Beyond "Get Started" and "Contact Sales," high-converting pages have micro-conversions: demo requests, ROI calculators, template downloads, newsletter signup, free tool access.

## Report Genre
**Landscape + Decision** — Comparative analysis of competitor patterns with specific implementation recommendations for Dealenz.

## Sourcing Strategy

| Subtopic | Source Types | Channels |
|----------|-------------|----------|
| Competitor landing page analysis | Primary (live pages), Industry analysis, Screenshots | Direct web fetch, Archive.org for historical |
| Conversion patterns | Industry reports, CRO case studies, A/B test results | Marketing blogs (Unbounce, CXL, VWO), SaaS benchmarks |
| Legal tech buyer requirements | Analyst reports (Gartner, Forrester), Peer reviews (G2, Capterra) | Review sites, Analyst PDFs |
| Enterprise SaaS benchmarks | Vendor reports (Gong, Linear, Stripe engineering blogs) | Company engineering/design blogs |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Competitor pages change during research | Medium | Low | Capture screenshots + archive URLs immediately |
| Gated analyst reports inaccessible | High | Medium | Prioritize public sources; note gaps explicitly |
| Subjective "high-converting" claims | High | High | Require triangulation: public case study + third-party benchmark + pattern consistency across ≥3 competitors |

## Stop Criteria
- All 6 hypotheses confirmed/refuted/underdetermined with ≥3 sources each
- ≥15 competitor pages analyzed (8 legal tech + 2 adjacent + 5 general enterprise)
- 50+ sources collected with credibility scores
- Adversarial pass completes with no unaddressed counter-arguments

## Output Structure
```
enterprise-saas-landing-pages/
├── plan.md
├── sources.csv
├── sources/
│   ├── 01_ironclad_homepage.md
│   ├── 02_evisort_homepage.md
│   └── ...
├── findings/
│   ├── F1_social_proof_patterns.md
│   ├── F2_technical_credibility.md
│   ├── F3_product_depth_demos.md
│   ├── F4_role_based_entry.md
│   ├── F5_seo_content_hub.md
│   └── F6_conversion_tiers.md
├── refresh_targets.md
└── 2026-10-03_landscape-decision.md
```