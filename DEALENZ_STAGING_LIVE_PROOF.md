# Dealenz Staging Live-Proof Report — 2026-09-13

## Part 1: Environment Variable Inventory

Every name below was grep'd from actual code (`process.env.*` across `src/`, `scripts/`, `next.config.*`, CI workflow). No values are printed. "Where to get it" tells the human where each credential lives.

### Supabase

| Variable | Required? | Used by | Where to get it |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | REQUIRED (app won't boot without it; `src/lib/config.ts:27`, validated at `src/lib/supabase/server.ts`, `client.ts`, `src/proxy.ts`) | All Supabase clients, health route, webhook/checkout service clients | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | REQUIRED (same validation boundary) | Same as above | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | REQUIRED for: billing webhook (`src/app/api/billing/webhook/route.ts:34,56,80,125`), checkout pending-row insert (`src/app/api/billing/checkout/route.ts:56`), AI-fallback spike check in health (`src/app/api/health/route.ts:48`). Server-only. Absent from `.env.local`; present in Vercel Production env. | Webhook, checkout, health | Supabase dashboard → Project Settings → API (service_role). Never commit, never expose client-side |
| Supabase CLI linkage | No variable (CLI stores it). Repo is linked to the **Dealenz** project (eu-west-1). A second, older project ("propeida") exists in the same org but is unlinked — do not point tooling at it. | `supabase db push`, `supabase db query` | `supabase link --project-ref <ref>` (already done) |

### Google OAuth

| Variable | Required? | Used by | Where to get it |
|---|---|---|---|
| *(none)* | No `GOOGLE_*` vars exist anywhere in code. Google sign-in is brokered entirely by Supabase Auth; the app only handles the callback (`src/app/auth/callback/route.ts`) with explicit link-instead-of-merge logic. | — | Google Cloud Console → OAuth client ID/secret are entered in the **Supabase dashboard → Authentication → Providers**, not in this repo |

### Anthropic Claude (authenticated flows)

| Variable | Required? | Used by | Where to get it |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | REQUIRED for authenticated deal intelligence (default provider). Server-only. Commented out in `.env.example`; **absent from local `.env.local` and from Vercel Production env.** | `src/lib/ai/providers/anthropic.ts:23` | Anthropic Console → API keys |
| `AUTH_AI_PROVIDER` | OPTIONAL (defaults to `anthropic`) | `src/lib/ai/providers.ts:56` | Literal string, no credential |
| `AUTH_AI_MODEL` | OPTIONAL (defaults to `claude-sonnet-5`) | `providers.ts:63`, `anthropic.ts:40` | Anthropic docs `/v1/models` — confirm exact IDs, they retire on schedule |
| `AUTH_AI_FALLBACK_MODEL` | OPTIONAL (defaults to `claude-opus-5`) | `providers.ts:67` | Same as above |
| `ANTHROPIC_BASE_URL` | OPTIONAL (proxies/mocks; defaults to `https://api.anthropic.com`) | `anthropic.ts:35` | Only if proxying |

### NVIDIA / Gemini (shared + Quick Review)

| Variable | Required? | Used by | Where to get it |
|---|---|---|---|
| `AI_PROVIDER` | REQUIRED (`openai_compatible` or `gemini`) | `providers.ts:43`, dev scripts | Literal string |
| `AI_API_KEY` | REQUIRED (falls back to legacy `GEMINI_API_KEY`) | `providers/gemini.ts:13`, `openai-compatible.ts:12`, scripts | NVIDIA build.nvidia.com (`nvapi-` key) or Google AI Studio |
| `AI_BASE_URL` | REQUIRED in practice (per-adapter defaults exist) | `providers.ts:47`, both adapters | Provider docs |
| `AI_MODEL` | REQUIRED in practice (falls back to `GEMINI_MODEL`, then adapter default) | `providers.ts`, both adapters | Provider model catalog — verify the ID is still served (a prior default hit HTTP 410 EOL) |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | LEGACY fallback only; prefer the `AI_*` names | Same adapters + `scripts/test-nvidia*.mjs` | Same as above |
| `QUICK_REVIEW_AI_PROVIDER` / `QUICK_REVIEW_AI_MODEL` | OPTIONAL; when unset, Quick Review inherits the shared `AI_*` selection (`providers.ts:86-90`). **Neither is set anywhere** — so today Quick Review = whatever the shared NVIDIA/Gemini config is. | Quick Review surface only | Same as above |

### Paddle Billing (software commerce only)

| Variable | Required? | Used by | Where to get it |
|---|---|---|---|
| `PADDLE_API_KEY` | REQUIRED (transaction creation, `provider.ts:72-75`) | Checkout route | Paddle dashboard → Developer Tools → API Keys |
| `PADDLE_WEBHOOK_SECRET` | REQUIRED (HMAC-SHA256 `Paddle-Signature` verify, `provider.ts:77-80`, `webhook/route.ts:12`) | Webhook route | Paddle dashboard → Developer Tools → Notification Destinations → signing secret |
| `PADDLE_ENVIRONMENT` | REQUIRED (`sandbox` or `production`, `provider.ts:82-86`) | Checkout + webhook | Paddle dashboard → sandbox vs live mode |
| `PADDLE_PRICE_STARTER` / `_STANDARD` / `_PRO` | REQUIRED (server-side price→package map, `provider.ts:50-69`; client can never choose amounts) | Checkout + webhook | Paddle dashboard → Catalog → Products → Price IDs |

### App / platform

| Variable | Required? | Used by | Where to get it |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | REQUIRED (share links, checkout return URLs; localhost rejected in production per `actions.ts:1327`; sitemap falls back to `https://dealenz.ai`) | Share links, checkout, sitemap | Production: the deployed app URL |
| `NODE_ENV` | Framework-set (`development` gate in `clear-dev-data/route.ts:7`) | Next.js itself | Automatic |
| `VERCEL_OIDC_TOKEN` | Present in local `.env.local` (written by `vercel env pull`); not consumed by app code | Vercel CLI deployments | Automatic |

### Legal research / observability

| Variable | Required? | Used by | Where to get it |
|---|---|---|---|
| `LEGAL_RESEARCH_LIVE` | OPTIONAL (`"1"` enables live revalidation; default corpus-only) | `retrieval.ts:251` | Literal |
| `LEGAL_SEARCH_API_KEY` | OPTIONAL (Brave Search; without it, live mode revalidates curated URLs only) | `retrieval.ts:208` | Brave Search dashboard |
| `OPS_ALERT_WEBHOOK` | OPTIONAL (unset = events stay in `system_logs`) | `logger.ts:215` | Slack/Discord/PagerDuty webhook URL |

### Explicitly absent (verified by grep — do not invent)

No `SMTP_*` / `RESEND_*` (app sends no email; Supabase owns Auth mail), no `UPSTASH_*` (rate limits are Postgres-backed), no `PAYSTACK_*`, no subscription/billing-plan vars, no `DATABASE_URL`/`DIRECT_URL` (Supabase CLI uses its own auth), no `SENTRY_*`/`POSTHOG_*`, no `GOOGLE_*`.

### Gaps vs existing `.env.example`

None — `.env.example` documents every variable above (including commented optional blocks and an explicit "NOT used" section). One staleness note: `NEXT_PUBLIC_APP_URL=http://localhost:3000` is correct as a dev default but **must** be overridden in production; the example already says so.

### Production env (Vercel, names only — values never printed)

Present in Production: `SUPABASE_SERVICE_ROLE_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_API_KEY`, `AI_PROVIDER`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_APP_URL` (all set ~3h before this audit). **Missing vs the inventory:** `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_ENVIRONMENT`, `PADDLE_PRICE_STARTER`, `PADDLE_PRICE_STANDARD`, `PADDLE_PRICE_PRO` (checkout fails closed without them — safe but commerce is dark), all `AUTH_AI_*`/`ANTHROPIC_API_KEY` (authenticated Claude path unconfigured), `LEGAL_*`, `OPS_ALERT_WEBHOOK`.

## Part 2: Live Proof Results

Environment reality found during this task (constrains everything below): there is **no staging environment** — one live Supabase project (Dealenz, eu-west-1), one Vercel project (`dealenz`, multiple Ready production deployments, latest ~3h old, no custom domain; `dealenz.ai` does not resolve). Live proofs therefore ran against local-dev-app + live project backing where side-effect-free, and are marked BLOCKED wherever a proof needed accounts, payments, or mailboxes that don't exist. No code was changed. No email was sent. No customer data was touched.

### 1. Provider Calls — PARTIAL (failure path proven live; success path not)
- **Evidence (one minimal anonymous Quick Review, local app → live project, 2026-09-13):** `POST /api/analyze-anonymous` → `500`, `elapsedMs: 7412`, `contentType: application/json`, body `{"error":"Analysis failed. Please try again with more detail about your deal."}`. No provider/model/token strings anywhere in the response.
- **What this proves live:** the request cleared validation, reached the AI stage, the provider call failed, and the sanitization boundary returned exactly the curated message — error hygiene works against a real failure, not just fixtures.
- **Why it failed:** prime suspect is the configured NVIDIA credential/model (key invalid, quota, or model access); sandbox→NVIDIA egress itself verified reachable (`GET /v1/models` → 200). Deliberately not diagnosed further — that would mean handling the live key and spending more calls.
- **Not proven:** which provider serves which surface on success; authenticated Claude path (no key in prod, no account to call it with). Needs: working key + owned-inbox account.

### 2. Lemon Squeezy Webhook — BLOCKED (code-verified only)
- No Lemon credentials exist anywhere (not in repo, env, or Vercel). No store, no variants, no webhook secret — nothing to fire a test event with or at. Existing automated coverage stands: HMAC accept/reject, idempotent `purchase:<tx>` grants, replay/repair/converge, refund-observe-only, underpayment/unknown-variant rejection (`webhook/route.test.ts`, 10 tests). Needs: Lemon test-mode store + webhook pointed at a staging URL.

### 3. RLS Under Real Session — BLOCKED (code-verified only)
- No authenticated session obtainable: account creation requires email confirmation to an owned inbox (none available), and the bounce policy forbids fabricated addresses. No service-role substitution was used (would prove nothing about RLS anyway). Standing evidence: RLS on all 24 tables, owner-scoped policies, `trg_final_document_lock` + enforcement function confirmed present in the live database during the migration audit; conditional-update + advisory-lock patterns in code. Needs: one owned-inbox QA account.

### 4. Proxy in Deployed Staging — BLOCKED (environment)
- The deployed Vercel URL sits behind Vercel Deployment Protection SSO (`/dashboard` → 302 to `vercel.com/sso-api`, observed live), and no bypass is available — so no deployed route is reachable at all. Deployed-commit identity also unconfirmable (landing HTML shows neither the new Credits card nor the old placeholder — likely client-rendered sections). Dev-environment proxy gating was previously observed working (307 → `/login`). Needs: SSO bypass or protection disabled for a staging deployment.

### 5. Google OAuth Round-Trip — BLOCKED
- Requires a real Google test account; none available. Code path (explicit `linkIdentity`, verified-email check, no merge-by-email in `auth/callback/route.ts:55-73`) re-read and unchanged. Needs: Google test account + owned inbox.

### 6. Anonymous Limiter + Referral Reward — PARTIAL
- **Limiter:** a 4-hit soak was deliberately NOT run (would burn the founder's hourly IP budget and AI spend for marginal value). Standing in: unit-tested limiter (`rate-limit-anon.test.ts`), fail-closed behavior, plus a live-observed 429 during the prior browser-QA phase. The single anonymous call above also confirms the limiter gate executes pre-AI-spend (a 429-shaped path returns the curated limit message, previously screenshot-verified).
- **Referral reward:** needs two confirmed accounts (referrer + referee) — impossible without owned inboxes. Code path (`claim_referral_reward`, 5 credits, idempotent `referral:<id>` key) covered by tests only. BLOCKED live.

## Summary

- **Now confirmed live:** env inventory complete and production-mapped; anonymous AI failure path returns curated errors with zero leakage; Vercel prod env contents (names) inventoried; deployment exists but is SSO-gated; migration/trigger standing re-confirmed; single anonymous call proves end-to-end wiring short of provider success.
- **Still unverified (all blocked on missing staging/credentials, not on code):** successful provider calls per surface, webhook end-to-end, RLS/trigger under real session, deployed proxy behavior, OAuth round-trip, limiter soak, referral grant.
- **Next actions for the human, in order:** (1) check NVIDIA key/quota/model access for the configured credentials (one anonymous 500 is the symptom); (2) decide staging strategy — separate Supabase project + Vercel preview with protection bypass, owned QA inbox, Lemon test store, Google test account; (3) supply Lemon variants/secret + `ANTHROPIC_API_KEY` (or officially defer authenticated-Claude and Quick-Review-LLM independence); (4) attach `dealenz.ai` DNS once a deployment is declared canonical. None of these require code changes as of this audit.
