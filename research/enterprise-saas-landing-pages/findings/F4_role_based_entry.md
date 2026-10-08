# Finding F4: Role-Based Entry Points

**Hypothesis H4:** Role-based entry points align with buying committee structure — Enterprise SaaS pages segment content for different buyers (Legal/GC, Procurement, Sales Ops, IT/Security, Finance) with tailored value props, not a single linear narrative.

**Status:** CONFIRMED with high confidence (triangulated across legal tech + general enterprise)

---

## Evidence Summary

### Legal Tech Competitors — Role-Based Entry Patterns

| Competitor | Explicit Role Sections | Roles Addressed | Tailored Value Props |
|------------|------------------------|-----------------|---------------------|
| **Ironclad** | ✅ **Yes** — "An AI CLM platform built for the entire enterprise" with 3 tabs | **Selling** (Sales), **Purchasing** (Procurement), **Operations** (Legal Ops/HR) | Selling: "MSAs/SOWs at speed of business"<br>Purchasing: "Vendor contracts, see commitments before budget"<br>Operations: "Employment contracts, NDAs, partnerships in minutes" |
| **Evisort** | ❌ No explicit roles on homepage | Solutions by industry (Healthcare, Financial Services) | Industry-tailored, not role-tailored |
| **ContractPodAi** | ✅ **Yes** — "For Sales & Revenue", "For Procurement" | Sales, Procurement | Sales: "Self-service workflows, Salesforce, fast-track NDAs"<br>Procurement: "Insight into contract details, high-value supply chain" |
| **Lexion** | ✅ **Yes** — **"Who Uses Lexion" section with 6 roles** | **Legal, Sales, Procurement, HR, Finance, IT** | Each role: specific pain point + "See more →" link to dedicated solution page |
| **Sirion** | ⚠️ Partial — "Who Is Sirion For?" on solutions page; Industries on homepage | Financial Services, Healthcare, etc. (industry-focused) | Industry-tailored compliance (SOX, DORA, FINRA) |
| **LinkSquares** | ❌ No explicit roles | Legal-focused ("legal" in hero) | Single legal persona |
| **DocuSign** | ✅ **Yes** — "View solutions: Sales, Customer Experience, Procurement, Human Resources, Legal, More" | **Sales, CX, Procurement, HR, Legal** | Each role: dedicated solution page with tailored use cases |
| **PandaDoc** | ⚠️ Industry pages (Professional Services) | Industry verticals | Industry-tailored |

### General Enterprise Benchmarks

| Competitor | Role-Based Entry | Roles/Paths |
|------------|------------------|-------------|
| **Gong** | ✅ **Yes** — "Everyone wins with Gong" with 5 roles | **CRO, RevOps, Sales, Customer Success, Enablement** — each with tailored value prop |
| **Stripe** | ✅ **Yes** — Dual track + 3 integration paths | **Enterprises** (50% Fortune 100), **Startups** (88% Forbes AI 50), **No-code**, **Pre-integrated**, **Build your own** |
| **Linear** | ❌ Single persona (Product/Engineering) | N/A — developer tool, unified buyer |
| **Vercel** | ❌ Single persona (Developers/Platform Engineers) | N/A — developer infrastructure |
| **Notion** (referenced) | ❌ Single persona (Knowledge workers) | N/A — horizontal tool |

---

## Buying Committee for Legal Tech / Contract Intelligence

Based on competitor patterns and enterprise buying dynamics, the typical buying committee includes:

| Role | Primary Concerns | Value Prop Language |
|------|------------------|---------------------|
| **General Counsel / VP Legal** | Risk reduction, compliance, outside counsel spend, team efficiency | "Reduce outside counsel spend by X%", "99% obligation compliance", "Deterministic risk findings" |
| **Legal Operations / Contract Manager** | Workflow automation, template management, volume handling, reporting | "Centralize all contracts", "Automate routine review", "Executive-ready dashboards" |
| **Procurement / Vendor Management** | Vendor risk, renewal tracking, cost visibility, compliance | "Never miss a renewal", "See every commitment before budget", "SOX/DORA compliance" |
| **Sales Operations / Revenue Leaders** | Deal velocity, CRM integration, self-service NDAs, forecast accuracy | "Close deals 40% faster", "Salesforce integration", "Self-service contract generation" |
| **IT / Security / InfoSec** | Data residency, encryption, access control, SOC 2, AI governance | "EU-hosted, AES-256", "SOC 2 Type II", "ISO 27001", "Model risk management" |
| **Finance / CFO** | ROI, cost predictability, revenue recognition, audit readiness | "360% ROI (TEI study)", "Pay per deal outcome", "Revenue recognition automation" |

---

## Gap Analysis: Dealenz Current State

| Role Entry Element | Dealenz | Competitor Standard | Gap |
|-------------------|---------|---------------------|-----|
| Explicit role sections | ❌ None | Ironclad (3), Lexion (6), Gong (5), DocuSign (5), ContractPodAi (2) | **Critical** |
| Tailored value props per role | ❌ Single narrative | All above have role-specific messaging | **Critical** |
| Role-based navigation | ❌ None | Lexion ("See more →" per role), DocuSign (solution pages) | **High** |
| Buying committee content | ❌ None | Implicit in role sections | **High** |
| Industry + Role matrix | ❌ Industries only (4) | Ironclad (role + industry), Sirion (industry compliance) | **Medium** |

---

## Implementation Recommendations for Dealenz

### Must-Have (Priority 1)
1. **"Who Uses Dealenz" Section** — Explicit role cards for: **General Counsel**, **Legal Operations**, **Procurement**, **Sales Operations**, **IT/Security**, **Finance** — each with:
   - Role-specific headline (e.g., "General Counsel: Reduce outside counsel spend 40%")
   - 2-3 bullet pain points solved
   - "See how [Role] uses Dealenz →" link to dedicated page

2. **Dedicated Role Pages** — `/solutions/general-counsel`, `/solutions/legal-operations`, `/solutions/procurement`, `/solutions/sales-operations`, `/solutions/it-security`, `/solutions/finance` — each with:
   - Role-specific hero
   - Relevant product features (not all features)
   - Relevant metrics/case studies
   - Role-specific CTA ("Book GC demo", "Download Procurement guide")

### Should-Have (Priority 2)
3. **Buying Committee Guide** — "How to build the business case for Dealenz" — PDF/download addressing each role's objections
4. **Industry × Role Matrix** — Combine existing Industries with Roles (e.g., "Procurement in Enterprise Tech", "GC in Real Estate")

### Nice-to-Have (Priority 3)
5. **Persona-Based Chat/Quiz** — "Which best describes you?" → routes to relevant content
6. **Role-Specific Demo Flows** — Demo environment pre-loaded with persona-relevant contract types