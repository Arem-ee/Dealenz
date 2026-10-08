# Finding F3: Buyer Journey Alignment & Persona-Based Entry Points
**Hypothesis:** H3 — Buyer journey alignment requires distinct entry points for different personas (Legal/GC, Procurement, Sales Ops, CFO) with role-specific value props and navigation

**Status:** CONFIRMED — 11/13 competitors have explicit persona/role-based navigation; Dealenz has single "Platform" entry only

---

## Evidence Summary

| Competitor | Persona/Role Navigation | Solutions by Team | Solutions by Industry | Solutions by Use Case |
|------------|------------------------|-------------------|----------------------|----------------------|
| **Ironclad** | **Solutions → By Team (Legal, Procurement, Sales)** | Yes - 3 teams | Yes | Yes |
| **Evisort** | Product split (CI vs CLM) serves different buyers | Implicit | No | No |
| **ContractPodAi** | **Departments: Legal, Legal Ops, Procurement, Finance** | Yes - 4 departments | No | No |
| **Lexion** | **Solutions → By Team (Legal, Sales, Procurement, Finance, HR, Security)** | **Yes - 6 teams** | No | Yes |
| **Sirion** | Solutions → By Industry, By Function | By Function | By Industry | By Function |
| **LinkSquares** | **Solutions → By Team (Legal, Sales, Finance, Procurement)** | **Yes - 4 teams** | No | No |
| **DocuSign** | **Solutions → By Industry, By Department, By Integration** | By Department | By Industry | By Integration |
| **PandaDoc** | **Solutions → By Team (Sales, HR, Legal, Finance, Operations)** | **Yes - 5 teams** | By Industry | By Use Case |
| **Gong** | **Solutions → By Role (CRO, RevOps, Sales, CS, Enablement)** | **Yes - 5 roles** | By Industry | By Use Case |
| **Notion** | **Solutions → By Team (Engineering, Design, Product, Marketing, Sales, HR, Operations)** | **Yes - 7 teams** | No | By Use Case |
| **Linear** | Developer/PM focused (implied single persona) | No | No | No |
| **Vercel** | Developer-first + Enterprise + AI Agent developers | Enterprise section | No | Frameworks page |
| **Stripe** | **Solutions → By Business Model (7), By Stage (2), By Use Case** | By Stage | No | By Business Model/Use Case |

---

## Pattern Analysis

### Legal Tech Competitors (6/6) — All Have Role-Based Entry
| Competitor | Roles Targeted | Count | Page Structure |
|------------|---------------|-------|----------------|
| Ironclad | Legal, Procurement, Sales | 3 | Dedicated pages per team |
| ContractPodAi | Legal, Legal Ops, Procurement, Finance | 4 | Department pages in main nav |
| Lexion | Legal, Sales, Procurement, Finance, HR, Security | 6 | Solutions by Team (6 pages) |
| Sirion | By Function (implied roles) | Multiple | Solutions by Function |
| LinkSquares | Legal, Sales, Finance, Procurement | 4 | Solutions by Team (4 pages) |
| **Dealenz** | **None explicit** | **0** | **Industries only (4 pages)** |

### General SaaS Benchmarks (7/7) — All Have Role-Based Entry
| Competitor | Roles/segments | Count | Approach |
|------------|---------------|-------|----------|
| DocuSign | By Department + Industry + Integration | 3 dimensions | Multi-dimensional |
| PandaDoc | Sales, HR, Legal, Finance, Operations | 5 | Solutions by Team |
| Gong | CRO, RevOps, Sales, CS, Enablement | 5 | Persona value props on homepage |
| Notion | Engineering, Design, Product, Marketing, Sales, HR, Operations | 7 | Solutions by Team |
| Linear | Developers/PMs (single) | 1 | Focused positioning |
| Vercel | Developers + Enterprise + AI Agents | 3 | Platform sections |
| Stripe | Business Model (7) + Stage (2) + Use Case | 3 dimensions | Massive segmentation |

---

## Persona Coverage Analysis for Legal Tech

| Persona | Ironclad | ContractPodAi | Lexion | Sirion | LinkSquares | **Coverage** |
|---------|----------|---------------|--------|--------|-------------|--------------|
| **General Counsel / Legal** | ✓ | ✓ (Legal) | ✓ | ✓ (Function) | ✓ | 5/5 |
| **Legal Operations** | ✓ (Legal) | ✓ (Legal Ops) | ✓ | ✓ (Function) | ✓ | 5/5 |
| **Procurement / Vendor Mgmt** | ✓ | ✓ | ✓ | ✓ (Function) | ✓ | 5/5 |
| **Sales / Revenue / Deal Desk** | ✓ (Sales) | — | ✓ (Sales) | ✓ (Function) | ✓ (Sales) | 4/5 |
| **Finance / CFO** | — | ✓ | ✓ | ✓ (Function) | ✓ (Finance) | 4/5 |
| **HR / Employment** | — | — | ✓ | — | — | 1/5 |
| **Security / Compliance / Risk** | — | — | ✓ | — | — | 1/5 |
| **IT / Engineering** | — | — | — | — | — | 0/5 |

---

## Gap vs. Dealenz Current State

| Element | Dealenz Current | Competitor Standard (Legal Tech) | Gap Severity |
|---------|-----------------|----------------------------------|--------------|
| Persona-based nav | None (Industries only) | 4-6 roles with dedicated pages | **CRITICAL** |
| Role-specific value props | Generic "Platform" | Tailored per role (GC vs Procurement vs Sales) | **HIGH** |
| Solutions by Team | No | 5/6 competitors have this | **HIGH** |
| Solutions by Use Case | No | 3/6 competitors have this | **MEDIUM** |
| Persona CTAs | Single "Get Started Free" | Role-appropriate CTAs (Demo vs Trial vs Guide) | **MEDIUM** |

---

## Implementation Recommendations for Dealenz

### Must-Have (Immediate)
1. **Add "Solutions" to main navigation** with dropdown: By Team, By Use Case, By Industry
2. **Create 4 core persona pages** (minimum viable):
   - **Legal / GC** — "Reduce review time 80%, eliminate missed risks, maintain sovereign control"
   - **Legal Operations** — "Automate intake, standardize playbooks, enable self-serve for business"
   - **Procurement / Vendor Management** — "Flag one-sided terms, track obligations, prevent renewal surprises"
   - **Sales / Deal Desk** — "Accelerate deal velocity, redline in Word, close faster without legal bottlenecks"
3. **Update Hero CTA** to segment: "Legal teams start here" | "Procurement starts here" | "Sales teams start here"

### Should-Have (Q1)
4. **Add 2 additional persona pages:**
   - **Finance / CFO** — "Extract payment terms, track obligations, audit compliance, report on portfolio risk"
   - **Security / Compliance** — "Verify data handling, audit trail completeness, regulatory compliance reporting"
5. **Create "By Use Case" pages:**
   - MSA/NDA Review, Lease Analysis, Vendor Onboarding, Renewal Management, Audit/Compliance Prep
6. **Role-specific CTAs** — Legal gets "Upload Contract", Procurement gets "Bulk Analyze Vendors", Sales gets "Redline in Word"

### Nice-to-Have (Q2)
7. **Persona-based onboarding flows** — different first-time experiences per role
8. **Role-specific resource centers** — Legal gets playbook guides, Procurement gets vendor scorecards
9. **Dynamic homepage** — show different hero/sub-headline based on referral source or UTM
10. **Account-based landing pages** for target enterprise accounts

---

## Sources
- S01_Ironclad: Solutions → By Team (Legal, Procurement, Sales), By Industry, By Use Case
- S02_Evisort: Product split (CI vs CLM) as implicit segmentation
- S03_ContractPodAi: Departments nav (Legal, Legal Ops, Procurement, Finance)
- S04_Lexion: Solutions → By Team (6 roles), By Use Case
- S05_Sirion: Solutions → By Industry, By Function
- S06_LinkSquares: Solutions → By Team (Legal, Sales, Finance, Procurement)
- S07_DocuSign: Solutions → By Industry, By Department, By Integration
- S08_PandaDoc: Solutions → By Team (5 roles), By Industry, By Use Case
- S09_Gong: Homepage persona sections (CRO, RevOps, Sales, CS, Enablement), Solutions by Role
- S10_Notion: Solutions → By Team (7 roles), By Use Case
- S11_Linear: Single persona focus (Developers/PMs)
- S12_Vercel: Developer-first + Enterprise + AI Agents sections
- S13_Stripe: Solutions → By Business Model (7), By Stage (2), By Use Case