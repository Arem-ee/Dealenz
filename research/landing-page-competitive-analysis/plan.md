# Research Plan: High-Converting Enterprise SaaS Landing Pages for Legal Tech / Contract Intelligence

## Research Question
What sections, elements, and patterns do top-performing enterprise B2B SaaS landing pages (especially legal tech, contract review, deal intelligence) use that are missing from the current Dealenz landing page?

## Falsifiable Hypotheses

1. **H1: Enterprise legal tech landing pages require dedicated "Trust & Security" sections with specific compliance badges (SOC 2 Type II, ISO 27001, GDPR, HIPAA) that go beyond Dealenz's current Trust Strip with "SOC 2 Type II IN PROGRESS"**
   - *If false*: Top competitors don't prominently display compliance certifications on their main landing pages

2. **H2: High-converting pages include interactive product demos/sandboxes (not just static mockups) — e.g., live document upload, clause-level analysis playground, or guided product tours**
   - *If false*: Static illustrated mockups like Dealenz's are the industry standard

3. **H3: Buyer journey alignment requires distinct entry points for different personas (Legal/GC, Procurement, Sales Ops, CFO) with role-specific value props and navigation**
   - *If false*: Single generic "Platform" entry point is sufficient for enterprise buyers

4. **H4: Social proof follows a specific pattern: named customer logos + quantified case studies (ROI, time saved, risk reduced) + video testimonials from recognizable titles (GC, VP Legal, Head of Procurement)**
   - *If false*: Generic "trusted by" logo strips without metrics are standard

5. **H5: Technical credibility signals require dedicated "Integrations" sections showing native connectors (Salesforce, DocuSign, CLM platforms, storage providers) with architecture diagrams**
   - *If false*: Integration mentions in footer or passing references are sufficient

6. **H6: SEO/content strategy sections (Resource centers, blogs, guides, webinars, templates) are standard on enterprise legal tech landing pages to capture mid-funnel buyers**
   - *If false*: Landing pages focus purely on conversion with content living on separate subdomains

7. **H7: Pricing transparency for enterprise includes "Contact Sales" CTAs with clear qualification criteria, not just credit-based self-serve**
   - *If false*: Credit-based pricing like Dealenz's is the norm for this category

## Scope & Structure

### Target Competitors (Primary - Legal Tech / Contract AI)
- Ironclad (ironcladapp.com)
- Evisort (evisort.com)
- ContractPodAi (contractpodai.com)
- Lexion (lexion.ai)
- Sirion (sirion.ai)
- LinkSquares (linksquares.com)

### Adjacent Competitors (E-signature / Document Gen)
- DocuSign (docusign.com)
- PandaDoc (pandadoc.com)

### General Enterprise SaaS Benchmarks (Best-in-class patterns)
- Gong (gong.io)
- Notion (notion.so)
- Linear (linear.app)
- Vercel (vercel.com)
- Stripe (stripe.com)

### Report Genre
Landscape analysis with decision-support recommendations

### Report Blocks
1. Current State Audit (Dealenz page inventory)
2. Competitive Section Inventory (what each competitor has)
3. Pattern Analysis (recurring elements across top performers)
4. Gap Analysis (Dealenz vs. patterns)
5. Prioritized Recommendations (Must-have / Should-have / Nice-to-have)
6. Implementation Notes for Dealenz context

## Sourcing Strategy

### Primary Sources (Direct observation)
- Live landing page analysis of each competitor
- Archive.org snapshots for historical patterns
- View-source inspection for schema markup, analytics, A/B test variants

### Secondary Sources
- G2/Capterra reviews mentioning landing page experience
- Case studies published by competitors
- Webinar/slide decks from marketing teams (SlideShare, company blogs)
- Podcast interviews with marketing leaders at these companies

### Source Diversity Requirements
- ≥3 independent sources per thesis
- Source types: Primary (direct page analysis), Industry (G2, analyst reports), Discussion (Reddit, HN, Slack communities)
- Recency: Prioritize pages as they exist in Q3/Q4 2024

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Competitor pages change during research | Medium | Low | Screenshot + archive immediately; note date |
| Pages use dynamic content (A/B tests) | High | Medium | Check multiple sessions, incognito, different geos |
| Legal tech competitors gate content behind forms | Medium | High | Use archive.org, view-source, search for PDF assets |
| Insufficient public info on conversion metrics | High | Medium | Focus on observable patterns, not claimed metrics |

## Stop Criteria
- All 13 target companies analyzed
- ≥3 sources per hypothesis
- All 7 hypotheses confirmed/refuted/undetermined
- Pattern inventory complete with frequency counts

## Deliverables
- `sources/NN_<competitor>.md` — per-company landing page analysis
- `sources/NN_<industry-report>.md` — general SaaS benchmarks
- `findings/FN_<pattern>.md` — atomic pattern findings
- `sources.csv` — master index with credibility scores
- `YYYY-MM-DD_landscape.md` — final report
- `refresh_targets.md` — entities to monitor for updates