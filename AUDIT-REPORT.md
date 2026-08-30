# Dealenz — Full Codebase Audit Report

**Date:** 2026-06-24 · **Scope:** Entire codebase · **Mode:** Diagnostic only (no fixes applied)

---

## Section 1 — Project Structure

### Directory Tree

```
DEALENZ/
├── .agents/                        (empty directory — placeholder)
├── .env.example                    (env var template)
├── .env.local                      (live credentials, gitignored)
├── .gitignore
├── dealenz-dashboard-architecture.md (product spec document)
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts                  (CSP headers, server actions 10MB limit)
├── package.json
├── postcss.config.mjs
├── tsconfig.json                   (strict: true, target ES2017)
├── README.md
├── public/
│   ├── dealenz-workspace-preview.svg  (used in landing page)
│   ├── favicon.svg                    (used in logo, landing page)
│   └── fty.svg                        (ORPHANED — not referenced anywhere)
├── supabase/
│   └── migrations/                    (13 SQL migration files, 00001–00013)
├── src/
│   ├── proxy.ts                       (middleware — auth checks, route protection)
│   ├── app/
│   │   ├── layout.tsx                  (root HTML wrapper + metadata)
│   │   ├── page.tsx                    (marketing landing page)
│   │   ├── globals.css
│   │   ├── robots.ts
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── terms/
│   │   │   └── page.tsx
│   │   ├── privacy/
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   ├── layout.tsx               (dashboard shell — sidebar, topnav, mobile nav)
│   │   │   ├── page.tsx                 (dashboard home — attention, alerts, in-progress)
│   │   │   ├── activity/
│   │   │   │   └── page.tsx             (global activity timeline)
│   │   │   └── settings/
│   │   │       └── page.tsx             (business profile, notifications, security, team)
│   │   ├── deals/
│   │   │   └── page.tsx                 (deal pipeline grouped by stage)
│   │   ├── audit/
│   │   │   ├── new/
│   │   │   │   └── page.tsx             (creates audit record, redirects to workspace)
│   │   │   └── [id]/
│   │   │       ├── page.tsx             (deal workspace — fetches audit + events, renders WorkspaceClient)
│   │   │       └── actions.ts           (all server actions for audit lifecycle)
│   │   ├── clients/
│   │   │   ├── page.tsx                 (client list stub)
│   │   │   └── [id]/
│   │   │       └── page.tsx             (client detail page with deal history)
│   │   ├── risk-intelligence/
│   │   │   └── page.tsx                 (risk activity + risk library glossary)
│   │   ├── billing/
│   │   │   └── page.tsx                 (free plan display, usage counter)
│   │   ├── view/
│   │   │   └── [token]/
│   │   │       └── page.tsx             (client-facing portal — public, token-based)
│   │   └── api/
│   │       └── clear-dev-data/
│   │           └── route.ts             (dev-only endpoint to delete test audits)
│   ├── components/
│   │   ├── ui/                           (8 shadcn/ui components)
│   │   ├── animate-in.tsx
│   │   ├── auth-form.tsx
│   │   ├── draft-badge.tsx
│   │   ├── error-boundary.tsx
│   │   ├── icons.tsx
│   │   ├── legal-disclaimer.tsx
│   │   ├── logo.tsx
│   │   ├── mobile-nav.tsx
│   │   ├── portal-view.tsx
│   │   ├── settings-client.tsx
│   │   ├── sidebar-nav.tsx
│   │   ├── top-nav.tsx
│   │   └── audit/
│   │       ├── contextual-panel.tsx
│   │       ├── extraction-results.tsx
│   │       ├── file-upload.tsx
│   │       ├── guided-form.tsx
│   │       ├── input-type-selector.tsx
│   │       ├── paste-input.tsx
│   │       ├── pdf-documents.tsx
│   │       ├── pdf-export.tsx
│   │       ├── protection-package.tsx
│   │       ├── risk-report.tsx
│   │       ├── stage-stepper.tsx
│   │       ├── timeline.tsx
│   │       └── workspace-client.tsx
│   └── lib/
│       ├── generate.ts                   (document generation orchestration)
│       ├── logger.ts                     (system_logs writes)
│       ├── markdown.ts                   (markdown-to-HTML renderer)
│       ├── rate-limit.ts                 (increment_usage RPC wrapper)
│       ├── text-extract.ts               (PDF/DOCX/TXT text extraction)
│       ├── utils.ts                      (cn() helper)
│       ├── ai/
│       │   ├── extract.ts                (Gemini extraction call)
│       │   ├── prompts.ts                (all 6 prompt templates)
│       │   └── risk-analysis.ts           (Gemini risk analysis call + transform)
│       ├── risk/
│       │   └── engine.ts                 (rule-based fallback risk engine)
│       └── supabase/
│           ├── client.ts                 (browser Supabase client)
│           └── server.ts                 (server Supabase client)
```

### Assessment

| Finding | Label |
|---------|-------|
| `public/fty.svg` is **not referenced** by any file in `src/`. Appears to be leftover scaffold. | **ORPHANED** |
| `.agents/` is empty — placeholder directory never populated | **SCAFFOLD** |
| `eslint.config.mjs` exists but no lint script runs `eslint .` (only `eslint`) | **RISK: lint command incomplete** |
| Migration SQL files are well-organized (13 numbered migrations) | **PASS** |
| Architecture doc is at root level (not in `docs/` subdirectory) as a single `.md` file | **PASS** |
| No duplicate or near-duplicate files found | **PASS** |
| Business logic lives in `lib/ai/` and `lib/risk/` — no logic misplaced in components | **PASS** |
| Components receive data as props (server components fetch, client components render) — with exceptions (see Section 7) | **PASS** with caveats |

---

## Section 2 — Database Schema

### Tables (10 total)

| # | Table | Purpose | Columns | FKs | RLS | Assessment |
|---|-------|---------|---------|-----|-----|------------|
| 1 | `audits` | Core deal/audit record | 14 | `user_id→auth.users`, `client_id→client_profiles` | ✅ SELECT/INSERT/UPDATE/DELETE: `auth.uid() = user_id` | **PASS** |
| 2 | `usage_tracking` | Daily rate-limit counters | 6 | `user_id→auth.users` | ✅ SELECT: own user | **PASS** |
| 3 | `system_logs` | Operational/diagnostic logging | 7 | `audit_id→audits`, `user_id→auth.users` | ✅ INSERT: authenticated; SELECT: service_role only | **PASS** |
| 4 | `client_profiles` | Client identity + history | 9 | `user_id→auth.users` | ✅ ALL: `auth.uid() = user_id` | **PASS** |
| 5 | `activity_events` | Timeline/activity feed | 6 | `user_id→auth.users`, `audit_id→audits` | ✅ SELECT/INSERT: own user | **PASS** |
| 6 | `checklist_items` | Deliverables checklist items | 10 | `audit_id→audits`, `user_id→auth.users` | ✅ ALL: own user | **PASS** |
| 7 | `business_profiles` | User's business identity for documents | 16 | `user_id→auth.users (UNIQUE)` | ✅ ALL: own user | **PASS** |
| 8 | `document_versions` | Versioned document content | 8 | `audit_id→audits`, `user_id→auth.users` | ✅ SELECT/INSERT: own user | **PASS** |
| 9 | `share_tokens` | Token-based document sharing | 7 | `audit_id→audits` | ✅ ALL: via audit ownership | **PASS** |
| 10 | `document_signatures` | Client signature records | 8 | `share_token_id→share_tokens`, `audit_id→audits` | ✅ SELECT: via audit ownership; INSERT: anon via SECURITY DEFINER | **PASS** |

### Specific Checks

| Check | Found? | Location | Label |
|-------|--------|----------|-------|
| Deliverables checklist states (in-scope/out-of-scope/change-order) | ✅ | `checklist_items.status` with CHECK constraint | **PASS** |
| Activity/timeline events table | ✅ | `activity_events` table, written on every state change | **PASS** |
| `ai_consent` column on audits | ✅ | `audits.ai_consent BOOLEAN DEFAULT false` | **PASS** |
| Document versioning | ✅ | `document_versions` table with `version_number` | **PASS** |
| Client profile table (separate from deals) | ✅ | `client_profiles` table + `audits.client_id` FK | **PASS** |
| Share/signing tokens | ✅ | `share_tokens` + `document_signatures` | **PASS** |
| Orphan columns (nothing reads/writes) | ❌ None | Every column is used by at least one query | **PASS** |
| Missing columns that frontend expects | ❌ None | All `.select()` calls match actual columns | **PASS** |

### RLS Coverage

| PASS | All 10 tables have RLS enabled with correctly scoped policies |
|------|---------------------------------------------------------------|
| PASS | `system_logs` correctly restricts SELECT to `service_role` |
| PASS | Anonymous functions (`get_shared_document`, `sign_shared_document`) correctly use `SECURITY DEFINER` and `GRANT EXECUTE TO anon` |
| PASS | Storage bucket (`audit-files`) has RLS policy scoping to `auth.uid()` via folder prefix |

**Overall: PASS** — Schema is complete, consistent, and aligned with frontend queries. No gaps.

---

## Section 3 — Authentication

### Auth Provider: Supabase Auth

| Component | Assessment |
|-----------|------------|
| **Sign-up** (`register/page.tsx` + `auth-form.tsx`) | Calls `supabase.auth.signUp()`. On success, shows confirmation message. | **PASS** |
| **Sign-in** (`login/page.tsx` + `auth-form.tsx`) | Calls `supabase.auth.signInWithPassword()`. On success, redirects to `/dashboard`. | **PASS** |
| **Session persistence** | SSR cookie-based via `@supabase/ssr`. Middleware (`proxy.ts`) refreshes session on every request via `getSession()` → `getUser()`. | **PASS** |
| **Middleware matcher** | Excludes `_next/static`, `_next/image`, `favicon.ico`, static images. Covers all app routes. | **PASS** |
| **Route protection** | Middleware redirects unauthenticated users away from `/dashboard/*`, `/audit/*`, `/deals`, `/clients`, `/risk-intelligence`, `/billing` to `/login`. | **PASS** |
| **Public routes** | `/login`, `/register`, `/terms`, `/privacy`, `/view/*` explicitly allowed without auth. | **PASS** |
| **Server action auth** | Every exported action in `actions.ts` calls `getUser()` and throws/returns error if null. | **PASS** |
| **API route auth** | `/api/clear-dev-data` calls `getUser()` and returns 401 if null. | **PASS** |

### Server-Component Query Scoping

| Page | Calls `getUser()`? | Redirects if null? | DB query scoped to `user.id`? | Label |
|------|-------------------|--------------------|------------------------------|-------|
| `dashboard/layout.tsx` | ✅ | ✅ redirect | ✅ | **PASS** |
| `dashboard/page.tsx` | ✅ | ❌ (no redirect — layout handles it) | ❌ `.select("*")` no user_id filter | **RISK** |
| `audit/[id]/page.tsx` | ✅ | ✅ redirect | ❌ `.select("*").eq("id", id)` no user_id filter | **RISK** |
| `audit/new/page.tsx` | ✅ | ✅ redirect | ✅ (insert uses `user.id`) | **PASS** |
| `deals/page.tsx` | ✅ | ❌ (no redirect) | ❌ no user_id filter | **RISK** |
| `clients/page.tsx` | ✅ | ❌ (no redirect) | ❌ no user_id filter | **RISK** |
| `clients/[id]/page.tsx` | ✅ | ❌ (no redirect) | ❌ no user_id filter on client_profiles or audits query | **RISK** |
| `risk-intelligence/page.tsx` | ✅ | ❌ (no redirect) | ❌ no user_id filter | **RISK** |
| `billing/page.tsx` | ✅ | ❌ (no redirect) | ✅ (usage_tracking scoped) | **PASS** |
| `dashboard/activity/page.tsx` | ✅ | ❌ (no redirect — layout handles it) | ⚠️ `user?.id ?? ""` — falls back to empty string | **RISK** |
| `dashboard/settings/page.tsx` | ✅ | ✅ redirect | ✅ | **PASS** |

**Key finding: 7 server-component DB queries rely solely on RLS without explicit `user_id` scoping.** If RLS were ever disabled or misconfigured, these would leak all users' data. Defense-in-depth is weak.

---

## Section 4 — API Layer and Server Actions

### API Routes

| Route | Method | Purpose | Auth | Input Validation | Error Handling | Label |
|-------|--------|---------|------|-----------------|----------------|-------|
| `/api/clear-dev-data` | POST | Deletes dev/test audits by title match | ✅ getUser() + 401 | ❌ Deletes by title match only — no audit ID validation, no ownership verification beyond RLS | ✅ Returns 200/401/404/500 | **RISK** |

### Server Actions (all in `src/app/audit/[id]/actions.ts`)

| Action | Input | Auth | Validation | Error Handling | Label |
|--------|-------|------|------------|----------------|-------|
| `updateAudit` | `id, data{title,raw_input,source_type,structured_data,status,ai_consent,client_id}` | ✅ getUser() | ✅ ALLOWED_FIELDS whitelist + ALLOWED_STATUS_VALUES | ✅ throws with message | **PASS** |
| `attachFileMetadata` | `auditId, fileData{path,size,type,name}` | ✅ getUser() | ✅ path prefix validation, MAX_FILES_PER_AUDIT | ✅ throws | **PASS** |
| `removeFileMetadata` | `auditId, filePath` | ✅ getUser() | ❌ none (deletes by path) | ✅ throws | **PASS** |
| `analyzeDeal` | `auditId` | ✅ getUser() + email_verified | ✅ ownership check, lock mechanism, rate limit, content guard | ✅ try/catch, rollback to "failed", returns error object | **PASS** |
| `generateProtectionPackage` | `auditId` | ✅ getUser() + email_verified | ✅ rate limit, requires extractedData + riskReport | ✅ try/catch, returns error | **PASS** |
| `updateChecklistItem` | `itemId, data{status,notes}` | ✅ getUser() | ✅ user owns item | ✅ throws | **PASS** |
| `populateChecklistItems` | `auditId` | ✅ getUser() | ✅ ownership check | ✅ throws | **PASS** |
| `upsertBusinessProfile` | `data{...}` | ✅ getUser() | ✅ allowedBusinessFields whitelist | ✅ throws | **PASS** |
| `createShareToken` | `auditId, documentType` | ✅ getUser() | ✅ documentType enum check, revokes old tokens | ✅ returns error object | **PASS** |
| `revokeShareToken` | `tokenId` | ✅ getUser() | ❌ no explicit ownership check (RLS covers it) | ✅ returns error | **PASS** (RLS) |
| `getShareStatus` | `auditId` | ✅ getUser() | ❌ none (read-only) | ✅ returns error | **PASS** |
| `getClientProfiles` | none | ✅ getUser() | ❌ none (read-only) | ✅ returns error | **PASS** |
| `logDocumentActivity` | `auditId, documentType, activityType` | ✅ getUser() | ✅ union type for activityType | ✅ throws | **PASS** |

---

## Section 5 — Gemini Integration (Critical)

### 5a. Prompt Architecture

| Finding | Detail | Label |
|---------|--------|-------|
| **Location** | All 6 prompts in `src/lib/ai/prompts.ts` — single dedicated constants file | **PASS** |
| **Count** | 2 JSON-returning system prompts (extraction, risk analysis) + 4 Markdown-returning document builders (proposal, SOW, contract, checklist) | **PASS** |
| **Structure** | Every prompt has system role instruction + output format requirements (exact JSON schema or explicit markdown sections) + constraints | **PASS** |
| **Output format vs frontend** | Extraction prompt asks for fields matching `ExtractedData` interface. Risk prompt asks for fields matching (transformed) `RiskReport`. Document prompts ask for Markdown matching `GeneratedDocument.content`. | **PASS** |
| **Dead code** | Risk prompt asks Gemini for `recommendations` but `transformGeminiOutput` ignores the field. `RiskReport` type has no `recommendations` field. | **RISK: wasted tokens** |
| **Dead code** | `mapSeverity()` function in `risk-analysis.ts` is never called — `transformGeminiOutput` uses `severityFromScore()` instead | **RISK: dead code** |

### 5b. Model and API Usage

| Finding | Detail | Label |
|---------|--------|-------|
| **Model** | `process.env.GEMINI_MODEL || "gemini-2.0-flash"` — default is `gemini-2.0-flash`, configurable via env var | **PASS** |
| **API key** | `process.env.GEMINI_API_KEY` — read from env, checked at call sites with `throw new Error("GEMINI_API_KEY not set")` | **PASS** |
| **SDK** | No official SDK. All calls use raw `fetch()` to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}` | **PASS** (functional) |
| **Duplicated code** | Three identical `callGemini` implementations in `extract.ts`, `risk-analysis.ts`, and `generate.ts` — same URL construction, same 30s `AbortController`, same error handling | **RISK: maintenance burden** |
| **Model validation** | No validation that `GEMINI_MODEL` is a valid model ID — will fail with HTTP 4xx at runtime if set to a non-existent model | **MISSING** |

### 5c. Response Handling

| Scenario | Handling | Label |
|----------|----------|-------|
| **Malformed JSON (extraction)** | `parseExtractedResponse` does raw `JSON.parse` without its own try/catch — BUT caller wraps in try/catch and rethrows with message | **PASS** (error message is generic) |
| **Malformed JSON (risk analysis)** | `parseRiskResponse` has its own try/catch, logs error, rethrows as descriptive message. Caller falls back to rule engine. | **PASS** |
| **Timeout (30s)** | All 3 `callGemini` implementations use `AbortController` with 30s timeout. Extraction rethrows -> caught in actions.ts. Risk analysis falls back to rule engine. Document generation falls back to templates. | **PASS** |
| **Code-block stripping regex** | `/```json\s*/gi` + `/```\s*$/g` — the second regex anchors to end-of-string. If AI returns trailing whitespace or newlines after closing backticks, the regex won't match and `JSON.parse` will get raw backticks. | **RISK: brittle** |
| **Raw response storage** | Gemini's raw response text is **never persisted** — only parsed structured data or markdown content is saved | **MISSING: no debugging/replay capability** |
| **Would bad response crash the flow?** | No — every failure path has a catch and either marks the audit as "failed", falls back to rule engine, or falls back to template generation | **PASS** |

### 5d. Output Usage

| Frontend field | Gemini provides? | Used? | Label |
|----------------|-----------------|-------|-------|
| `ExtractedData.goals` | ✅ | ✅ | **PASS** |
| `ExtractedData.deliverables` | ✅ | ✅ | **PASS** |
| `ExtractedData.timeline` | ✅ | ✅ | **PASS** |
| `ExtractedData.budget` | ✅ | ✅ | **PASS** |
| `ExtractedData.projectType` | ✅ | ✅ | **PASS** |
| `ExtractedData.clientSignals` | ✅ | ✅ | **PASS** |
| `ExtractedData.missingInformation` | ✅ | ✅ | **PASS** |
| `ExtractedData.confidence` | ✅ | ✅ | **PASS** |
| `RiskReport.overallScore` | ✅ | ✅ | **PASS** |
| `RiskReport.riskLevel` | ✅ (remapped) | ✅ | **PASS** |
| `RiskReport.summary` | ✅ | ✅ | **PASS** |
| `RiskReport.categories[].score` | ✅ (computed) | ✅ | **PASS** |
| `RiskReport.categories[].severity` | ✅ (computed) | ✅ | **PASS** |
| `RiskReport.categories[].findings` | ✅ | ✅ | **PASS** |
| `RiskReport.categories[].mitigations` | ✅ | ✅ | **PASS** |
| `RiskReport.recommendations` | ❌ (not in type) | ❌ (field never read) | **WASTE: AI generates it, code throws it away** |
| `GeneratedDocument.content` | ✅ (markdown) | ✅ | **PASS** |

---

## Section 6 — Frontend Routing and Page Coverage

### Route Inventory

| Route | Renders | Auth Required | Auth Enforced? | Loading/Error/Empty States | Architecture Match | Label |
|-------|---------|---------------|----------------|---------------------------|-------------------|-------|
| `/` | Marketing landing page | ❌ (redirects authenticated users to `/dashboard`) | ✅ | Static page | ✅ | **PASS** |
| `/login` | Login form | ❌ | N/A public | ✅ spinner + error | ✅ | **PASS** |
| `/register` | Register form | ❌ | N/A public | ✅ spinner + error | ✅ | **PASS** |
| `/terms` | Static terms | ❌ | N/A public | N/A | ✅ | **PASS** |
| `/privacy` | Static privacy | ❌ | N/A public | N/A | ✅ | **PASS** |
| `/dashboard` | Dashboard home (attention, alerts, in-progress, quick-start, recent activity) | ✅ | ✅ (layout redirect) | ✅ empty states + "All clear" | ✅ action-oriented dashboard | **PASS** |
| `/dashboard/activity` | Global activity timeline | ✅ | ✅ (layout) | ✅ "Nothing's happened yet" | ✅ Activity Timeline | **PASS** |
| `/dashboard/settings` | Settings (business profile, notifications, integrations, security, team) | ✅ | ✅ (own redirect + layout) | ✅ initial profile state | ✅ Settings per arch | **PASS** |
| `/deals` | Deal pipeline grouped by stage | ✅ | ❌ no redirect (relies on RLS) | ✅ "Your first deal starts here" | ✅ Pipeline view | **RISK** |
| `/audit/new` | Creates audit + redirects to workspace | ✅ | ✅ redirect | ✅ throws/error boundary | ✅ Deal creation | **PASS** |
| `/audit/[id]` | Deal workspace (WorkspaceClient) | ✅ | ✅ redirect + notFound() | ✅ 404 for missing | ✅ Core workspace | **PASS** |
| `/clients` | Client list stub | ✅ | ❌ no redirect | ✅ empty state explanation | ⚠️ "In preview" | **RISK** |
| `/clients/[id]` | Client detail with deal history | ✅ | ❌ no redirect | ✅ empty states | ⚠️ Basic (missing tabs: Risk Patterns, Notes) | **RISK** |
| `/risk-intelligence` | Risk activity + Risk Library glossary | ✅ | ❌ no redirect | ✅ "No flags yet" + always-visible library | ✅ | **RISK** |
| `/billing` | Free plan display + usage counter | ✅ | ❌ no redirect | ✅ plan info always shows | ✅ | **PASS** |
| `/view/[token]` | Client-facing document viewer + signing | ❌ public (token-based) | ✅ token validation + notFound() | ✅ invalid token → 404 | ✅ Client portal (Critical feature) | **PASS** |

### Specific Architecture Checks

| Requirement | Status | Label |
|-------------|--------|-------|
| Client-facing portal route (`/view/[token]`) | ✅ Exists with document rendering + signing flow | **PASS** |
| Activity Timeline route | ✅ Global (`/dashboard/activity`) + per-deal (tab in workspace) | **PASS** |
| Document versioning route | ❌ No UI to browse, diff, or restore document versions (data IS stored in `document_versions`) | **MISSING** |
| Follow-up reminders | ❌ No system for unsent/unresponded proposals | **MISSING** |
| Templates route (`/templates`) | ❌ Route does not exist; sidebar has 4 items instead of 5 | **MISSING** |
| Notifications drawer | ⚠️ Bell icon + panel exist, but "Mark all read" button is not wired, no read/unread persistence | **PARTIAL** |
| Command palette search (`⌘K`) | ⚠️ Opens search modal, but only searches audits by title — architecture specifies grouped results (Deals, Clients, Templates, Documents) | **PARTIAL** |
| Client profile detail tabs | ⚠️ Architecture specifies 4 tabs (Overview, Deal History, Risk Patterns, Notes); only deal history is rendered | **PARTIAL** |

---

## Section 7 — Component Audit

### Non-Audit Components

| Component | Used? | Types | Error/Empty/Loading | Fetches own data? | Label |
|-----------|-------|-------|-------------------|-------------------|-------|
| `AnimateIn` | ✅ WorkspaceClient, ProtectionPackage | ✅ Interface | N/A animation | No | **PASS** |
| `AuthForm` | ✅ login/page, register/page | ✅ `mode` union | ✅ spinner + error | ✅ calls `supabase.auth` directly | **PASS** |
| `DraftBadge` | ✅ ProtectionPackage, WorkspaceClient | ✅ `DraftState` union | N/A display | No | **PASS** |
| `ErrorBoundary` | ✅ WorkspaceClient | ✅ class component | ✅ fallback + retry | No | **PASS** |
| `Icons` | ✅ many pages | ✅ `IconProps` | N/A | No | **PASS** |
| `LegalDisclaimer` | ✅ risk-report, protection-package | ✅ `className?`, `compact?` | N/A | No | **PASS** |
| `Logo` | ✅ sidebar, register, login | ✅ `className?`, `showText?` | N/A | No | **PASS** |
| `MobileNav` | ✅ dashboard/layout | ✅ proper types | N/A nav only | No | **PASS** |
| `PortalView` | ✅ view/[token]/page | ✅ `SharedDocument` + `token` | ✅ signing loading + error | ✅ calls `supabase.rpc("sign_shared_document")` | **PASS** |
| `SettingsClient` | ✅ dashboard/settings/page | ✅ `initialProfile`, `email` | ✅ save state machine | No (uses server action) | **PASS** |
| `SidebarNav` | ✅ dashboard/layout | ✅ `email`, `businessName` | N/A | No (sign-out destructures from supabase client directly) | **PASS** |
| **`TopNav`** | ✅ dashboard/layout | ✅ `SearchResult`, `NotificationItem` | ✅ empty states for notifications | ✅ **Fetches own data**: `supabase.from("audits").ilike()` for search, `supabase.from("activity_events")` for notifications | **RISK** |

### Audit Workspace Components

| Component | Used? | Types | Error/Empty/Loading | Data source | Label |
|-----------|-------|-------|-------------------|-------------|-------|
| `WorkspaceClient` | ✅ audit/[id]/page | ✅ 8+ interfaces | ✅ consent wall, analyzing spinner, failed retry, empty input, error dismissals | Props + server actions | **PASS** (complex but correct) |
| `StageStepper` | ✅ WorkspaceClient | ✅ `StageId`, `StageState` | N/A nav only | Props | **PASS** |
| `Timeline` | ✅ WorkspaceClient | ✅ `TimelineEvent` | ✅ "No activity yet" | Props | **PASS** |
| `RiskReport` | ✅ WorkspaceClient | ✅ from `@/lib/risk/engine` | ✅ "No significant risks" | Props | **PASS** |
| `ProtectionPackage` | ✅ WorkspaceClient | ✅ `ProtectionPackageProps` | ✅ loading for share/regenerate | Props + server actions | **PASS** |
| `PdfExport` | ✅ ProtectionPackage | ✅ typed props | ✅ loading from PDFDownloadLink | Props | **PASS** |
| `PdfDocuments` | ✅ PdfExport | ✅ `PdfContentProps` | N/A pure render | Props | **PASS** |
| `PasteInput` | ✅ WorkspaceClient | ✅ `PasteInputProps` | ✅ "No content yet", char limit | Props | **PASS** |
| `InputTypeSelector` | ✅ WorkspaceClient | ✅ `InputType` union | N/A | Props | **PASS** |
| `GuidedForm` | ✅ WorkspaceClient | ✅ `FormFields`, `GuidedFormProps` | N/A controlled form | Props | **PASS** |
| `FileUpload` | ✅ WorkspaceClient | ✅ `FileUploadProps` | ✅ loading overlay, error display, empty state | ✅ Direct `supabase.storage` calls + server actions | **RISK** |
| `ExtractionResults` | ✅ WorkspaceClient | ✅ from `@/lib/ai/extract` | ✅ empty goals/deliverables | Props | **PASS** |
| `ContextualPanel` | ✅ WorkspaceClient | ✅ `ContextualPanelProps` | ✅ placeholder when no data | Props | **PASS** |

### DraftBadge "reviewed" state

| Finding | Detail | Label |
|---------|--------|-------|
| IntersectionObserver in ProtectionPackage | Watches `contentEndRef` at 90% threshold. Scrolling to bottom of document content triggers "reviewed" state. Tab-open alone does not trigger it — user must scroll. | **PASS** (scroll required) |
| Manual "Mark reviewed" button | Explicit user action in ProtectionPackage | **PASS** |
| **Persistence** | Reviewed state is a local `Set<DocumentType>` — lost on page refresh. Not persisted to DB. `logDocumentActivity("document_viewed" | "document_reviewed")` does fire to activity_events, but the UI badge state is volatile. | **RISK** |

---

## Section 8 — State Management

| State Type | Where | Examples | Assessment |
|------------|-------|----------|------------|
| **Local component state** | `useState` in client components | WorkspaceClient (22 states), AuthForm (4), SettingsClient (14), ProtectionPackage (6) | ✅ Works but WorkspaceClient is at complexity limit |
| **Server state (props)** | Server components fetch, pass as props | All `page.tsx` files → client components | ✅ **Good pattern** |
| **URL state** | Next.js params | `/audit/[id]`, `/view/[token]`, `/clients/[id]` | ✅ Standard |
| **Server actions** | Mutations via `actions.ts` | All write operations | ✅ Proper pattern |
| **Global state store** | **None** | No React Context, Zustand, Jotai, Redux | **MISSING** |

### Risks in Current State Management

| Issue | Detail | Label |
|-------|--------|-------|
| `TopNav` fetches own search + notifications | Breaks the server-component data-flow pattern. Duplicates auth state fetching. | **RISK** |
| `FileUpload` calls `supabase.storage` directly | Mixes client SDK calls with server action architecture | **RISK** |
| `handleSave` captures initial `audit.title` | Stale closure — uses prop value from initial render, not latest `editTitle` state | **RISK** |
| DraftBadge reviewed state | Local-only `Set<DocumentType>` — reset on every page refresh | **MISSING persistence** |
| Auth state fetched independently | `TopNav` + `SidebarNav` + each page + each server action all call `getUser()` independently — no shared auth context | **Minor inefficiency** |

---

## Section 9 — TypeScript Coverage

### Type Check Result

```
npx tsc --noEmit: 0 errors, 0 warnings — COMPILES CLEAN
```

### Analysis

| Metric | Value | Label |
|--------|-------|-------|
| Type errors | **0** | **PASS** |
| Strict mode | `"strict": true` in tsconfig | **PASS** |
| `any` usage in critical paths | **None found** — API responses typed, DB return types have interfaces, Gemini response parsing uses proper types | **PASS** |
| Untyped interfaces | All component props, server action inputs/outputs, and data types have explicit TypeScript interfaces | **PASS** |
| `skipLibCheck: true` | Standard — skips node_modules type checking | **PASS** |

Notable: `transformGeminiOutput` in `risk-analysis.ts` casts the parsed JSON result as `any` initially before validation. This is unavoidable since Gemini returns untyped JSON. The function validates the structure before returning typed data. Acceptable practice.

---

## Section 10 — Environment and Build

### Environment Variables

| Variable | In Code | In `.env.example` | In `.env.local` | Label |
|----------|---------|-------------------|-----------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ | **PASS** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ | **PASS** |
| `GEMINI_API_KEY` | ✅ | ✅ | ✅ | **PASS** |
| `GEMINI_MODEL` | ✅ | ✅ | ❌ (absent, falls back to `gemini-2.0-flash`) | **WARNING** |
| `NEXT_PUBLIC_APP_URL` | ✅ (in `createShareToken`) | ✅ | ❌ (absent — will break share link construction at runtime) | **FAIL at runtime** |

### Build Output (from `npm run build`)

```
✓ Compiled successfully in 39.1s
✓ TypeScript in 16.6s — 0 errors
✓ Generating static pages (3/3) in 507ms
✓ Route (app) — all routes listed
✓ Proxy (Middleware) listed
```

| Check | Result | Label |
|-------|--------|-------|
| Build compiles clean | ✅ Zero warnings | **PASS** |
| TypeScript | ✅ 0 errors | **PASS** |
| Lint | ⚠️ Script is `"lint": "eslint"` — runs `eslint` without arguments, which will lint nothing. Should be `eslint .` or `eslint src/`. | **BROKEN** |

### npm Audit

```
2 moderate severity vulnerabilities
postcss <8.5.10 — PostCSS XSS via Unescaped </style>
  transitive dependency of next@16.2.9
  No fix available without breaking Next.js (requires next@9.3.3)
```

| Vulnerability | Severity | Label |
|---------------|----------|-------|
| PostCSS XSS (CSS stringify) | **moderate** | **RISK** — accepted transitive risk |

---

## Section 11 — What Works End-to-End Right Now

### Happy Path

1. **Landing page** (`/`) → user clicks "Start Free Audit"
2. **Register** (`/register`) → fills email/password → submits → Supabase Auth sends confirmation email → shows "Check your email" message
3. **Sign in** (`/login`) → enters credentials → redirected to `/dashboard`
4. **Dashboard** (`/dashboard`) → shows empty state with "Your first deal starts here" + "New Deal" button
5. **Click "New Deal"** → `POST /audit/new` creates a record in `audits` table → redirects to `/audit/{id}`
6. **Deal Workspace** → user selects input type (paste, upload, or guided form) → enters client brief
7. **Click "Analyze"** → server action `analyzeDeal()`:
   - Checks auth, email verification, rate limit, lock
   - Calls `extractProjectData()` → Gemini extracts structured data
   - Calls `analyzeRisk()` → Gemini analyzes + rule engine fallback
   - Writes `structured_data`, `risk_report`, `overall_score` to DB
   - Writes activity events for analysis start/completion
   - Returns extracted data + risk report
8. **User sees risk report** → score gauge, category cards, findings, contextual panel with deal health
9. **Click "Generate Protection Package"** → server action `generateProtectionPackage()`:
   - Checks auth, email verification, rate limit
   - Calls Gemini for proposal, SOW, contract, checklist content (each with fallback to template)
   - Saves to `document_versions` with incremented `version_number`
   - Populates `checklist_items` from extracted deliverables
   - Writes activity events for document generation
   - Returns documents
10. **User views documents** → tabs for Proposal/SOW/Contract/Checklist → markdown rendered
11. **User can scroll to bottom** → DraftBadge automatically shows "reviewed" (via IntersectionObserver)
12. **User can share** → `createShareToken()` creates 30-day token → generates sharable URL
13. **Client opens shared URL** (`/view/{token}`) → sees document via `PortalView` → can sign with name + email
14. **Client signs** → `sign_shared_document` RPC records signature in `document_signatures`, revokes token, creates activity event
15. **Back in workspace** → share status shows signed confirmation with timestamp

### Where the Flow Breaks or Dead-Ends

| Issue | Detail | Severity |
|-------|--------|----------|
| **Email confirmation wall** | `analyzeDeal` and `generateProtectionPackage` require `email_confirmed_at`. New users who haven't confirmed email see a verification wall on the dashboard. They can create audits but cannot analyze or generate. This is documented behavior but creates a dead-end for unconfirmed users. | **Important** |
| **`NEXT_PUBLIC_APP_URL` missing** | If `NEXT_PUBLIC_APP_URL` is not set, `createShareToken` will construct a broken share URL (likely `undefined/{token}`). Breaks the sharing flow at runtime. | **Critical** |
| **No follow-up reminders** | Once a proposal is shared, there is no mechanism to track whether the client has viewed it or remind the user to follow up. The flow terminates at "shared" with no closing loop. | **Missing** |
| **No document version UI** | `document_versions` stores every generation, but there is no UI to browse, diff, or restore previous versions. | **Missing** |
| **DraftBadge reviewed state is volatile** | If the user refreshes the page, all documents reset to "ai-draft" state in the UI. The `document_viewed`/`document_reviewed` events are in `activity_events` but not wired back to the badge. | **Minor** |
| **"Mark all read" in notifications does nothing** | The notifications panel has a "Mark all read" button but no handler is attached. | **Minor** |
| **Templates route absent** | Architecture specifies a `/templates` page with proposal/SOW/contract/checklist templates. Route does not exist. Not accessible from sidebar. | **Missing** |
| **Client profile detail tabs incomplete** | Architecture specifies 4 tabs (Overview, Deal History, Risk Patterns, Notes); only deal history exists. Risk Patterns and Notes are absent. | **Partial** |
| **Command palette limited** | `⌘K` search only searches audits by title. Architecture specifies grouped results across deals, clients, templates, and documents. | **Partial** |

---

## Section 12 — Security Surface

### Critical Findings

| Finding | File | Detail | Label |
|---------|------|--------|-------|
| 7 DB queries lack explicit user_id filter | Multiple `page.tsx` files | Server components query `audits` without `.eq("user_id", user.id)`. RLS is the only protection. If RLS is ever disabled, these leak all users' data. | **CRITICAL** |
| `NEXT_PUBLIC_APP_URL` missing from `.env.local` | Runtime | `createShareToken` constructs share URLs using `process.env.NEXT_PUBLIC_APP_URL`. If unset, share links will be broken. | **CRITICAL at runtime** |

### Important Findings

| Finding | File | Detail | Label |
|---------|------|--------|-------|
| Password minimum length is 6 | `auth-form.tsx` | Below industry standard (8+). Should be 8 minimum. | **Important** |
| `revokeShareToken` lacks explicit ownership check | `actions.ts:780` | RLS protects against cross-user revocation, but no code-level check exists | **Important** |
| `getShareStatus` lacks explicit ownership check | `actions.ts` | Same pattern — relies solely on RLS | **Important** |

### Minor Findings

| Finding | File | Detail | Label |
|---------|------|--------|-------|
| `TopNav` fetches search/notifications from client | `top-nav.tsx` | Client component queries `audits` and `activity_events` directly. Relies on RLS. | **Minor** |
| `FileUpload` calls `supabase.storage` directly | `file-upload.tsx` | Storage operations bypass server action pattern | **Minor** |
| `api/clear-dev-data` deletes by title match | `route.ts` | Deletes all audits titled "New Audit" or "New Deal" for the user. Fragile — a real deal with the same title would be deleted. | **Minor** |

---

## Prioritized Fix List

### Critical (breaks core functionality or is a security issue)
1. `NEXT_PUBLIC_APP_URL` missing from `.env.local` — share URLs will be broken at runtime
2. 7 server-component DB queries rely solely on RLS without explicit `user_id` filters — defense-in-depth weakness

### Important (degrades the product materially)
3. Three duplicated `callGemini` implementations — extract into shared utility
4. Code-block stripping regex in `parseRiskResponse`/`parseExtractedResponse` is brittle against trailing content
5. Email verification wall creates dead-end for unconfirmed users (no graceful degraded experience)
6. No follow-up reminders for shared/unresponded proposals
7. No document versioning UI despite data being stored
8. Password minimum length is 6 (should be 8+)
9. `revokeShareToken` lacks explicit ownership verification in application code

### Minor (polish, completeness, or nice-to-have)
10. `lint` script is `"eslint"` — should be `"eslint ."` or `"eslint src/"`
11. `recommendations` field in risk prompt is generated by Gemini but never consumed — wasted tokens
12. Dead `mapSeverity()` function in `risk-analysis.ts`
13. `public/fty.svg` is orphaned — not referenced anywhere
14. `.agents/` directory is empty — either populate or remove
15. Templates route (`/templates`) is missing from sidebar and routing (arch-doc specifies 5 sidebar items)
16. Client profile detail page missing 3 of 4 tabs (Risk Patterns, Notes, Overview)
17. Command palette (`⌘K`) only searches audits — architecture specifies grouped results across 4 entity types
18. Notifications "Mark all read" button has no handler
19. DraftBadge "reviewed" state is volatile (local-only `Set`, lost on refresh)
20. `handleSave` in `workspace-client.tsx` uses stale `audit.title` from initial render prop

---

**End of audit — 20 items in prioritized fix list.**
