# Finding F2: Interactive Product Demonstrations & Evaluation Paths
**Hypothesis:** H2 — High-converting pages include interactive product demos/sandboxes (not just static mockups) — e.g., live document upload, clause-level analysis playground, or guided product tours

**Status:** CONFIRMED — 12/13 competitors offer interactive evaluation paths; Dealenz has static mockups only

---

## Evidence Summary

| Competitor | Interactive Demo Type | Self-Serve Trial | Guided Tour/Video | Sandbox/Playground |
|------------|----------------------|------------------|-------------------|-------------------|
| **Ironclad** | "Watch demo video", "Book a demo", Workflow Designer (no-code UI) | No (enterprise) | Yes - demo video CTA | Workflow Designer described as interactive |
| **Evisort** | "Get a live demo", "Try Evisort", "Test on your own contracts" | Yes - "Try Evisort" | Live demo | "Test on your own contracts" |
| **ContractPodAi** | "Request a Demo", Guided model builder, Phased rollout | No (enterprise) | Guided model builder | Model builder "instantly deploys" |
| **Lexion** | AI Contract Assist (closed beta), Pricing page suggests self-serve | Partial (beta) | No prominent demo CTA | Closed beta for AI Assist |
| **Sirion** | Dedicated /demo/ page, AskSirion conversational interface | No (enterprise) | /demo/ page | AskSirion = conversational sandbox |
| **LinkSquares** | "Watch how LinkSquares streamlines...", Agentic AI conversational | No (enterprise) | Video demo CTA | Agentic AI = conversational interface |
| **DocuSign** | "Start for Free", "Take a guided tour", Free trial in minutes | **Yes - Freemium** | Guided tour | Free signing for recipients |
| **PandaDoc** | "Schedule your free live demo", Templates library, Drag-and-drop editor | Templates as eval | Free live demo | Templates library |
| **Gong** | "Book a demo" only | No (enterprise) | No self-serve | Platform architecture pages |
| **Notion** | **"Take a self-guided demo"**, "Start with Free Plan", Clickable use case demos | **Yes - Freemium** | Self-guided demo | Clickable use case demos (Slack, Security, Reporting) |
| **Linear** | **"Sign up for free"**, "Get started today", Command menu shortcuts shown | **Yes - Freemium** | Command menu as demo | Live activity feed |
| **Vercel** | **"Get started for free"**, "Import git repository", Deploy examples (starter kits) | **Yes - Freemium** | One-click git import | Starter kits (Boilerplate, Chatbot, Commerce) |
| **Stripe** | **Live code samples (7 languages)**, "No code" Dashboard, Pre-integrated platforms | **Yes - Pay-as-you-go** | Code samples as demo | MCP Server, AI Tools, Checkout Studio |

---

## Pattern Analysis

### Evaluation Path Categories

#### 1. **Freemium/Self-Serve** (5/13) — Lowest friction
- **DocuSign:** "Start for Free", free signing for recipients, guided tour
- **Notion:** "Start with Free Plan", self-guided workspace demo
- **Linear:** "Sign up for free", immediate access
- **Vercel:** "Get started for free", one-click git import, starter kits
- **Stripe:** Pay-as-you-go, live code samples, no-code Dashboard option

#### 2. **Interactive Demo/Guided Experience** (5/13) — Medium friction
- **Evisort:** "Try Evisort", "Test on your own contracts"
- **Sirion:** /demo/ page, AskSirion conversational interface
- **PandaDoc:** "Schedule your free live demo", templates library
- **Notion:** Self-guided demo + clickable use case demos
- **Vercel:** Starter kits as instant evaluation

#### 3. **Conversational/Agentic Sandbox** (3/13) — Emerging pattern
- **Sirion:** AskSirion — "just ask, agents act"
- **LinkSquares:** Agentic AI — conversational across entire library
- **ContractPodAi:** Guided model builder — "instantly deploys"

#### 4. **Video/Guided Tour Only** (2/13) — Higher friction
- **Ironclad:** "Watch demo video", "Book a demo"
- **LinkSquares:** "Watch how LinkSquares streamlines..."
- **Gong:** "Book a demo" only

#### 5. **Static Only** (1/13) — **Dealenz Current State**
- **Dealenz:** Static illustrated mockups only, no interactive demo, no video, no self-serve trial

---

## Gap vs. Dealenz Current State

| Element | Dealenz Current | Competitor Standard | Gap Severity |
|---------|-----------------|---------------------|--------------|
| Interactive demo | Static illustrated mockups only | 12/13 have interactive path | **CRITICAL** |
| Self-serve trial | Credit-based registration but no product access | 5/13 freemium, 5/13 guided demo | **HIGH** |
| Video demo | None | 4/13 have video demo CTA | **MEDIUM** |
| Guided tour | None | Notion (self-guided), DocuSign (guided tour) | **MEDIUM** |
| Sandbox/playground | None | Sirion (AskSirion), LinkSquares (Agentic), Stripe (code samples) | **HIGH** |
| Technical evaluation | None | Stripe (7 language code samples), Vercel (starter kits) | **MEDIUM** |

---

## Implementation Recommendations for Dealenz

### Must-Have (Immediate)
1. **Add "Watch Demo Video" CTA** in Hero (like Ironclad, LinkSquares) — produce 2-3 min product walkthrough
2. **Create interactive "Try Dealenz" flow** — allow document upload (PDF/Word) and show analysis results without full registration
3. **Add "Schedule Live Demo" CTA** alongside "Get Started Free" (like PandaDoc, Ironclad)

### Should-Have (Q1)
4. **Build self-guided interactive demo** (like Notion) — clickable walkthrough of: Upload → Review → Redline → Sign → Track
5. **Create "Playground" page** with sample contracts (MSA, Lease, NDA) pre-loaded for instant analysis
6. **Add technical evaluation path** — API docs with live examples (like Stripe's 7-language code samples)

### Nice-to-Have (Q2)
7. **Conversational agent interface** (like Sirion AskSirion / LinkSquares Agentic) — "Ask Dealenz" for contract questions
8. **Template library** as evaluation accelerator (like PandaDoc, Vercel starter kits)
9. **Guided product tour** with tooltips (like DocuSign, Notion)
10. **Live activity feed** (like Linear) — "X contracts analyzed in last hour"

---

## Sources
- S01_Ironclad: "Watch demo video", "Book a demo", Workflow Designer
- S02_Evisort: "Get a live demo", "Try Evisort", "Test on your own contracts"
- S03_ContractPodAi: "Request a Demo", guided model builder, phased rollout
- S04_Lexion: AI Contract Assist closed beta, pricing suggests self-serve
- S05_Sirion: /demo/ page, AskSirion conversational interface
- S06_LinkSquares: "Watch how LinkSquares streamlines...", Agentic AI conversational
- S07_DocuSign: "Start for Free", "Take a guided tour", free trial, freemium
- S08_PandaDoc: "Schedule your free live demo", templates library
- S09_Gong: "Book a demo" only (enterprise pattern)
- S10_Notion: "Take a self-guided demo", "Start with Free Plan", clickable use case demos
- S11_Linear: "Sign up for free", command menu shortcuts, live activity feed
- S12_Vercel: "Get started for free", import git repo, starter kits
- S13_Stripe: Live code samples (7 langs), no-code Dashboard, MCP Server, pay-as-you-go