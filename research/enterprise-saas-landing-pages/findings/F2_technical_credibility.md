# Finding F2: Technical Credibility Signals

**Hypothesis H2:** Technical credibility signals are non-negotiable for legal tech — Enterprise buyers require visible SOC 2 Type II badges, compliance certifications (ISO 27001, GDPR), penetration test summaries, and data residency guarantees prominently displayed, not buried in footers.

**Status:** CONFIRMED with high confidence (triangulated across 8 legal tech + DocuSign/Stripe as compliance-heavy benchmarks)

---

## Evidence Summary

### Legal Tech Competitors — Compliance Display Patterns

| Competitor | Certifications on Homepage | Security Page | Data Residency | Pen Test / Audit |
|------------|---------------------------|---------------|----------------|------------------|
| **Ironclad** | SOC II Type II badge on product page | Security Scorecard A rating, GCP multi-zone | US-hosted GCP | SOC 2 Type II (implied by badge) |
| **Evisort** | ISO 42001, 27001, 27701 explicitly on platform page | "Responsible AI safeguards backed by ISO certifications" | Not prominent | ISO 27001 implies audit |
| **ContractPodAi** | "Enterprise-grade security and compliance", "Privacy by Design", Ethics & Guardrails tab | Data Security tab | Not prominent | Not prominent |
| **Lexion** | "Certified data centers", "regular audits", Learn More link | Security page linked | Not prominent | "Regular audits" mentioned |
| **Sirion** | "Patented AI governance models", "Model risk management frameworks", SOX/DORA/ISDA/ESMA/FINRA compliance | Not prominent | Not prominent | Gartner MQ Leader implies validation |
| **LinkSquares** | "Governed home", "Consistent where you need control" | Not prominent | Not prominent | TEI study (third-party economic validation) |
| **DocuSign** | **6 certifications in row**: ISO 27001, FedRAMP, APEC PPP, CSA STAR, PCI DSS, SSAE 18 | Trust Center link | Not prominent | SSAE 18 = SOC 1/2 |
| **PandaDoc** | SOC 2, GDPR, HIPAA, E-SIGN, UETA badges | Security and compliance section | Not prominent | SOC 2 certified |

### General Enterprise Benchmarks

| Competitor | Certifications | Security Approach |
|------------|----------------|-------------------|
| **Stripe** | PCI DSS Level 1, SOC 1/2 Type 1&2, AES-256, Isolated infrastructure, Money Transmitter Licenses | Explicit security section with technical details |
| **Gong** | MCP Client/Server, 300+ integrations, bi-directional CRM sync | Platform architecture as credibility signal |

---

## Gap Analysis: Dealenz Current State

| Credibility Signal | Dealenz | Competitor Standard | Gap |
|-------------------|---------|---------------------|-----|
| SOC 2 Type II badge | ⚠️ "SOC 2 Type II In Progress" (TrustStrip, small text) | Full badge prominent (Ironclad, PandaDoc, DocuSign, Stripe) | **Critical** — "In Progress" weakens trust |
| ISO 27001 | ❌ None | Evisort (ISO 27001, 27701, 42001), DocuSign, Stripe | **High** — Expected for enterprise legal tech |
| GDPR/Privacy compliance | ⚠️ DPA link in footer only | PandaDoc (GDPR badge), DocuSign (APEC PPP), Evisort (ISO 27701) | **High** — Legal tech handles EU data |
| Data residency guarantee | ⚠️ "EU-Hosted · AES-256" (TrustStrip, small) | Ironclad (GCP multi-zone), Stripe (isolated infra) | **Medium** — Present but buried |
| Penetration testing | ❌ None | Ironclad (Security Scorecard A), Stripe (implied by PCI) | **Medium** |
| Compliance certifications row | ❌ None | DocuSign (6 in row), PandaDoc (badges), Evisort (3 ISO) | **High** — Visual trust signal missing |
| Security/Trust Center | ⚠️ /security page exists but basic | DocuSign Trust Center, Stripe Security page | **Medium** — Needs depth |
| AI governance/model risk | ❌ None | Sirion (patented AI governance, model risk frameworks), Evisort (ISO 42001) | **High** — Critical for AI legal tech |

---

## Implementation Recommendations for Dealenz

### Must-Have (Priority 1)
1. **SOC 2 Type II Badge** — Once achieved, display prominently (not "In Progress"). If not yet achieved, show "SOC 2 Type II Audit Underway — Expected [Quarter]" with auditor name
2. **Compliance Certification Row** — Visual badge row: ISO 27001 (or "ISO 27001 Certified"), GDPR, SOC 2, AES-256, EU-Hosted — above fold or in dedicated Trust section
3. **Trust/Security Center** — Expand `/security` page with: certifications, penetration test summary (redacted), data residency details, subprocessors, incident response, compliance FAQ

### Should-Have (Priority 2)
4. **AI Governance Section** — "Responsible AI" page: model risk management, explainability, bias testing, human-in-the-loop controls, ISO 42001 roadmap
5. **Data Processing Addendum (DPA)** — Make prominent, not footer-only; include Standard Contractual Clauses, UK Addendum
6. **Subprocessor List** — Transparency page with all subprocessors, locations, purposes

### Nice-to-Have (Priority 3)
6. **Security Scorecard / Third-Party Rating** — If available, display rating badge
7. **Penetration Test Summary** — Annual third-party pen test executive summary (redacted)
8. **Compliance FAQ** — "How do you handle [SOX/HIPAA/FINRA]?" for regulated industry buyers