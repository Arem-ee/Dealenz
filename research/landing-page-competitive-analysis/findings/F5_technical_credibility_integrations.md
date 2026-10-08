# Finding F5: Technical Credibility — Integrations, Architecture, API/Developer Experience
**Hypothesis:** H5 — Technical credibility signals require dedicated "Integrations" sections showing native connectors (Salesforce, DocuSign, CLM platforms, storage providers) with architecture diagrams

**Status:** CONFIRMED — 12/13 competitors have explicit integrations showcase; Dealenz has none

---

## Evidence Summary

| Competitor | Integrations Page/Section | Named Integrations | Count | API/Developer Docs | Architecture Details |
|------------|--------------------------|-------------------|-------|-------------------|---------------------|
| **Ironclad** | Platform → Integrations (nav) + Hero section | Salesforce, Coupa, Ramp, Slack + "30+" | 30+ | API Docs in Resources | "Deepest integrations", "#1 Salesforce integration", public APIs |
| **Evisort** | Product overview + Developer Portal | "Box to Salesforce to DocuSign" | Multiple | **Developer Portal** (developers.evisort.com) | API + productized integrations, custom AI models |
| **ContractPodAi** | Platform capabilities list | DocuSign, Adobe Sign, Microsoft Word | 3 named | Help Center | Multi-model AI, instant model deployment, permissions |
| **Lexion** | Repository page + API Docs | Microsoft Word (AI Contract Assist) | 1 named | **API Docs in Resources** | Homegrown NLP, 120+ fields, custom models in 1 week |
| **Sirion** | Platform → Manage page | ERP, P2P, ITSM systems | 3 categories | Sirion University | agentOS, 10+ LLMs + 1200+ SLMs, source attribution, fine-tuning |
| **LinkSquares** | Platform pages + API Docs | Microsoft Word (redlining) | 1 named | **API Docs in Resources** | LinkAI multi-agent, 10M+ trained, conversation memory |
| **DocuSign** | Hero + App Center | **1,000+ partner integrations**, Salesforce, Microsoft, Google, Zoom, Stripe, HubSpot, SharePoint | 1,000+ | **Developer Center + API Docs** | App Center, industry-leading APIs, cloud storage connections |
| **PandaDoc** | Products → Integrations (nav) | Salesforce, HubSpot, Zoho, Pipedrive, Google Drive, Zapier, Slack | 7+ named | **Developer Hub + API Docs** | Native e-sign (vs third-party), webhooks, embedded lead capture |
| **Gong** | Platform → Collective | **300+ integrations** in Gong Collective | 300+ | API Docs in Resources | Revenue Graph, Revenue Harness, Applications, Collective |
| **Notion** | Product → Integrations (nav) | Slack, GitHub, "connected apps" | Multiple | **API Docs in Resources** | AI governance, zero retention, enterprise connections (DLP/SIEM) |
| **Linear** | Features → Integrations | GitHub, GitLab, Sentry, Zendesk, Intercom, Slack, Zapier (1000+) | 7+ named + 1000 | **GraphQL API** | Git automations, Sentry integration, command menu |
| **Vercel** | Platform → Integrations + Marketplace | GitHub, GitLab, BitBucket, **MCP Server**, **Skills** | Marketplace | **Documentation, API, SDK, CLI, MCP, Skills** | Fluid Compute, Sandboxed VMs, AI Model Gateway, Durable Orchestration |
| **Stripe** | Products + Developer nav | **MCP Server**, **AI Tools**, pre-integrated platforms | Extensive | **Documentation, API Reference, SDKs, MCP, AI Tools** | 7-language code samples, pay-as-you-go, professional services |

---

## Integration Coverage by Category (Legal Tech Focus)

| Category | Ironclad | Evisort | ContractPodAi | Lexion | Sirion | LinkSquares | **Dealenz** |
|----------|----------|---------|---------------|--------|--------|-------------|-------------|
| **CRM** | Salesforce | Salesforce | — | — | — | — | **None** |
| **E-Signature** | — | DocuSign | DocuSign, Adobe Sign | — | — | — | **Proprietary** |
| **Document/Word** | — | — | Word | Word | Word | Word | **Copy-paste** |
| **Storage** | — | Box, Drive, OneDrive | — | — | — | — | **None** |
| **Procurement/ERP** | Coupa | — | — | — | ERP, P2P | — | **None** |
| **Finance/Expense** | Ramp | — | — | — | — | — | **None** |
| **Communication** | Slack | — | — | — | — | — | **None** |
| **Ticketing/ITSM** | — | — | — | — | ITSM | — | **None** |
| **API/Developer** | Public APIs | API + Developer Portal | Help Center | API Docs | Sirion University | API Docs | **Footer only** |
| **AI/Agent** | — | Custom AI models | Model builder | Custom models | agentOS, fine-tuning | Agentic AI, conversation memory | **Rulepacks only** |

---

## Architecture Transparency Patterns

| Competitor | Named Architecture Components | Model/Tech Details | Explainability |
|------------|------------------------------|-------------------|----------------|
| **Ironclad** | Workflow Designer, Jurist AI | Multi-agent AI, no-code automation | Rule-based verification |
| **Evisort** | Custom AI models, Developer Portal | Deep learning + active learning | Source links for answers |
| **ContractPodAi** | Leah agentOS, Model builder | Multi-LLM, 1200+ SLMs (per Sirion) | Source links, explanations |
| **Lexion** | Homegrown NLP platform | 3-step: Read → Structure → Classify | Clause-level extraction |
| **Sirion** | **agentOS**, 10+ LLMs + 1200+ SLMs | Model routing, fine-tuning | **Source links for every recommendation** |
| **LinkSquares** | **LinkAI**, Multi-agent | 10M+ contracts trained | Conversation memory, context |
| **DocuSign** | IAM Platform, App Center | AI-assisted summary/Q&A | — |
| **PandaDoc** | Native e-sign, Content library | Smart approval rules | Audit trails |
| **Gong** | Revenue Graph, Revenue Harness, Applications, Collective | Specialized agents, governed execution | — |
| **Notion** | AI governance, Enterprise connections | Zero retention, no training | Citations for answers |
| **Linear** | GraphQL API, Git automations | Command menu, Cycles | — |
| **Vercel** | Fluid Compute, Sandboxed VMs, AI Model Gateway, Durable Orchestration | MCP Server, Skills | — |
| **Stripe** | MCP Server, AI Tools, Checkout Studio | 7-language samples, AI-powered support | — |

---

## Gap vs. Dealenz Current State

| Element | Dealenz Current | Competitor Standard | Gap Severity |
|---------|-----------------|---------------------|--------------|
| Integrations section | **None** | 12/13 have dedicated integrations | **CRITICAL** |
| Named integrations | **None** | 3-1000+ named partners | **CRITICAL** |
| CRM integration | **None** | Salesforce (5/6 legal tech) | **CRITICAL** |
| E-signature integration | Proprietary only | DocuSign/Adobe Sign (3/6) + native | **HIGH** |
| Word/Document integration | Copy-paste workflow | Native Word add-in (4/6) | **HIGH** |
| Storage integration | **None** | Box/Drive/OneDrive (2/6) | **MEDIUM** |
| Procurement/ERP integration | **None** | Coupa/ERP/P2P (2/6) | **MEDIUM** |
| API/Developer Docs | Footer link only | First-class nav (10/13) | **HIGH** |
| Architecture transparency | "Deterministic rulepacks" only | Named components, model details | **HIGH** |
| Explainability | "Evidence-backed findings" | Source links per finding (3/6) | **MEDIUM** |
| AI/Agent infrastructure | Rulepacks only | Multi-agent, fine-tuning, MCP (emerging) | **MEDIUM** |

---

## Implementation Recommendations for Dealenz

### Must-Have (Immediate)
1. **Add "Integrations" to main navigation** (Platform, Solutions, **Integrations**, Resources, Pricing, Security, Company)
2. **Create /integrations page** with categories: CRM, E-Signature, Document/Word, Storage, Procurement/ERP, Communication, API
3. **Prioritize 4 key integrations** for MVP: **Salesforce** (CRM), **DocuSign/Adobe Sign** (E-sign), **Microsoft Word** (Redlining), **Google Drive/OneDrive** (Storage)
4. **Move API Docs to main Resources nav** (not footer only)

### Should-Have (Q1)
5. **Build native Microsoft Word add-in** for redlining (like Ironclad, Lexion, LinkSquares, Sirion, ContractPodAi)
6. **Create Salesforce integration** — sync contracts, push risks to Opportunities, auto-create records
7. **Add DocuSign/Adobe Sign integration** — send for signature from Dealenz, receive signed docs back
8. **Name architecture components**: "Rulepack Engine", "Evidence Trace System", "Clause Locator", "Counter-Draft Generator"
9. **Publish API documentation** with live examples (like Stripe's 7-language samples)

### Nice-to-Have (Q2)
10. **Procurement/ERP integrations** — Coupa, SAP Ariba, Oracle, NetSuite
11. **Communication integrations** — Slack, Teams notifications for reviews/approvals
12. **MCP Server / AI Agent Skills** — enable AI agents to use Dealenz (emerging pattern: Vercel, Stripe)
13. **Fine-tuning / Custom Rulepack Builder** — let customers create domain-specific rules (like ContractPodAi, Evisort, Sirion)
14. **Integration marketplace** — partner-built connectors (like Gong Collective, Vercel Marketplace)
15. **Architecture diagram** on /platform or /integrations page showing data flow

---

## Sources
- S01_Ironclad: Integrations nav, 30+ integrations, Salesforce/Coupa/Ramp/Slack, "deepest integrations", public APIs
- S02_Evisort: Developer Portal, API + productized integrations, Box/Salesforce/DocuSign, custom AI models
- S03_ContractPodAi: DocuSign, Adobe Sign, Word, multi-model AI, instant model deployment, permissions
- S04_Lexion: Word integration (AI Contract Assist), API Docs, homegrown NLP, 120+ fields, custom models in 1 week
- S05_Sirion: ERP/P2P/ITSM, agentOS, 10+ LLMs + 1200+ SLMs, source attribution, fine-tuning, Sirion University
- S06_LinkSquares: Word redlining, API Docs, LinkAI multi-agent, 10M+ trained, conversation memory
- S07_DocuSign: 1000+ integrations, App Center, Salesforce/Microsoft/Google/Zoom/Stripe/HubSpot/SharePoint, Developer Center
- S08_PandaDoc: Integrations nav, Salesforce/HubSpot/Zoho/Pipedrive/Drive/Zapier/Slack, Developer Hub, native e-sign, webhooks
- S09_Gong: 300+ in Gong Collective, Revenue Graph/Harness/Applications/Collective architecture
- S10_Notion: Integrations nav, Slack/GitHub, API Docs, AI governance, enterprise connections (DLP/SIEM)
- S11_Linear: GitHub/GitLab/Sentry/Zendesk/Intercom/Slack/Zapier, GraphQL API, Git automations
- S12_Vercel: GitHub/GitLab/BitBucket, MCP Server, Skills, Marketplace, Fluid Compute/Sandboxed VMs/AI Gateway
- S13_Stripe: MCP Server, AI Tools, pre-integrated platforms, 7-language code samples, professional services