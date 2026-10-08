# Phase C Market Research — Batch Ingestion + External Portals

Date: 2026-10-08. Method: vendor documentation + market guides (fetched full text).
Evidence limit: the batch-vendor search hit a rate limit mid-session, so
bulk-ingestion claims below rest on the 2025 CLM Best Practices Guide, PandaDoc,
and Dealenz's own engine — flagged where thinner. Portal claims are
multi-sourced. Nothing here is built yet; see `deliberation.md` for decisions.

## 1. Batch / bulk ingestion

### 1.1 What the market does

- **Bulk ingestion → extraction → repository** is a first-class flow. Upload
  the portfolio (including legacy contracts); AI extraction populates
  repository metadata — renewal dates, pricing terms, liability caps, key
  obligations — without per-file paralegal review. Sources: PandaDoc AI data
  extraction ("identify and extract specific fields across the full contract
  portfolio"); 2025 CLM Best Practices Guide ("bulk extraction: identify key
  content for repository search tagging, risk analysis, or compliance
  actions").
- **Formal intake channel.** One standardized entry point capturing contract
  type, counterparty, key business terms, timeline, and special requirements
  upfront; workflow automation routes by contract type and value. Source:
  PandaDoc intake + workflow recipes.
- **Threshold-based approval routing.** Contract type, deal value,
  counterparty, or risk level decides reviewers, sequence, and deadlines;
  high-value deals route to legal/finance in parallel, standard ones skip
  straight through, outliers flag for manual review. Sources: PandaDoc
  approval workflows; Malbek tiered thresholds; 2025 Guide ("map out all
  required approvers and decision points").
- **Portfolio rollup.** Outputs aggregate into dashboards and the repository
  (volumes, turnaround, deviations from standard, risk classification), not
  scattered per-file artifacts. Source: 2025 Guide reporting-needs section.

### 1.2 What the market does NOT do

- No vendor prices bulk compute back to the user per file, so **no vendor
  has a cost-estimate approval gate**. Dealenz's estimate-before-spend is a
  proprietary requirement (credits doctrine), not an industry copy.
- No vendor found gates bulk runs on a pre-flight manifest the user must
  approve file-by-file; the manifest + per-file ceiling is Dealenz's answer
  to its own surprise-billing risk.

## 2. External portals (employee / supplier / customer)

### 2.1 What the market does (convergent across vendors)

| Practice | Sources |
|---|---|
| Vendor sees **only their contracts** (row-level scoping, never the portfolio) | Sirion vendor-specific access; PeopleSoft row-level document security |
| **Tiered external roles**: Vendor User (read/comment/upload deliverables) vs Vendor Admin (manages own users) vs internal owners | Sirion RBAC table; D365 external roles (Vendor admin / Vendor / prospect) |
| **One primary external owner per document** — the single counterparty contact who may upload redlines back; all others view-only | PeopleSoft primary-external-owner rule |
| **Staged reconciliation** — external edits land *outside* version control; an internal admin accepts them into the version chain or carries changes over | PeopleSoft external-collaboration staging |
| **Time-bound access, auto-revoked** on deal close/expiry/role change; link revocation; MFA/SSO for externals | Sirion external-user controls |
| **Tasks + notifications** assigned to externals with status visibility | TxDOT portal (My Tasks, bell notifications, Chatter) |
| **Self-registration with approval** — vendor requests access, procurement approves, profile created | D365 provisioning; TxDOT signup |
| View-only / no-download / no-print modes, watermarking, DLP on sensitive fields | Sirion DLP + watermarking guidance |
| Negotiation in one shared environment: native redline + instant blackline, every change tracked by author and timestamp | PandaDoc collaborative redlining; Sirion version control |

### 2.2 What the market does NOT do

- Guests are never members: external identity is always a separate principal
  with its own provisioning path (D365 guest-user provisioning; Entra
  external IDs). No vendor gets an internal seat for collaboration.
- No vendor-side bulk export:least-privilege includes export restriction
  (Sirion: "restrict bulk export").

## 3. Dealenz's current position (pre-Phase C)

- Batch engine exists (`createBatchAnalysis`, executor concurrency, per-file
  classification); manifest UI, estimate-approval gate, failure isolation
  with retry, and Reports/Home rollup do not.
- Portal primitives exist (`/sign/[token]`, `deal_shares` with expiry,
  shared composer with asker/participant scope, SCIM-lite); audience doors,
  primary-owner upload-back, staged reconciliation, vendor-admin role, and
  external tasks do not.
- Positioning constraint (product.md, unchanged): guests ≠ members, enforced
  in the data model — identical to the market, already compliant.
