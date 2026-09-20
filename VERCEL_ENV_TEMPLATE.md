# Vercel Environment Template — Dealenz

Populate these in Vercel Project → Settings → Environment Variables.
Do not commit real values. All values below are names only.

## Public (exposed to browser where code requires NEXT_PUBLIC_)

| Variable | Where to obtain |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public key |
| `NEXT_PUBLIC_APP_URL` | Production URL of the deployed app (e.g. `https://dealenz.vercel.app`). Used for auth callbacks, billing return URLs, and canonical metadata. Must be the exact origin, no trailing slash. |

## Server-only (never prefix with NEXT_PUBLIC_)

### Supabase service role

| Variable | Where to obtain | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key | Server-only. Required for increment_usage, credit_ledger RPCs, storage RLS bypass where needed. |

### AI — general

| Variable | Where to obtain | Notes |
|---|---|---|
| `AI_PROVIDER` | Literal: `openai_compatible`, `gemini`, or `anthropic` | Controls `src/lib/ai/providers.ts` routing for legacy/shared paths; authenticated intelligence uses `AUTH_AI_*` |
| `AI_API_KEY` | Provider dashboard (OpenAI-compatible / NVIDIA `nvapi-` / Gemini) | Server-only. Falls back to `GEMINI_API_KEY` if not set, but set the canonical name. |
| `AI_BASE_URL` | Provider docs (OpenRouter: `https://openrouter.ai/api/v1`; NVIDIA: `https://integrate.api.nvidia.com/v1`; Gemini: `https://generativelanguage.googleapis.com/v1beta`) | Server-only |
| `AI_MODEL` | Provider model catalog | Server-only |

### AI — authenticated Deal Intelligence (OpenRouter live)

| Variable | Where to obtain | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Console → API Keys | Server-only. Only needed when `AUTH_AI_PROVIDER` is `anthropic` (direct Anthropic). **Unused on OpenRouter — do not set one for OpenRouter.** |
| `AUTH_AI_PROVIDER` | Literal: `openai_compatible` | Set `openai_compatible` to route authenticated calls through the OpenAI-compatible adapter (OpenRouter). Controls `src/lib/ai/providers.ts:54` `resolveAuthProvider()` |
| `AUTH_AI_MODEL` | OpenRouter model catalog (`https://openrouter.ai/models`) | **Must be an exact OpenRouter `provider/model` id — verified live 2026-09-19, e.g. `anthropic/claude-sonnet-5`.** A retired/unknown id (e.g. `anthropic/claude-3.5-sonnet`, absent from OpenRouter) fails EVERY authenticated call with HTTP 404. No fallback exists on this path. |
| `AUTH_AI_FALLBACK_MODEL` | OpenRouter model ID | Unused when provider is `openai_compatible` (no fallback on that path); only applies to direct Anthropic. Leave empty. |

### Paddle (software commerce — Merchant of Record)

| Variable | Where to obtain | Notes |
|---|---|---|
| `PADDLE_API_KEY` | Paddle Dashboard → Developer Tools → Authentication | Server-only. Live or sandbox key. |
| `PADDLE_WEBHOOK_SECRET` | Paddle Dashboard → Developer Tools → Notifications → Destination secret | Server-only. Verifies `Paddle-Signature`. |
| `PADDLE_PRICE_STARTER` | Paddle Dashboard → Catalog → Product → Price ID | Server-only. Price for 50-credit Starter. |
| `PADDLE_PRICE_STANDARD` | Paddle Dashboard → Catalog → Product → Price ID | Server-only. Price for 150-credit Standard. |
| `PADDLE_PRICE_PRO` | Paddle Dashboard → Catalog → Product → Price ID | Server-only. Price for 400-credit Pro. |

All other variables (`PADDLE_ENVIRONMENT`, `LEGAL_RESEARCH_LIVE`, `LEGAL_SEARCH_API_KEY`, `OPS_ALERT_WEBHOOK`, `GEMINI_*`) are optional. Prompt caching is always on for `claude-sonnet-5` via `src/lib/ai/providers/anthropic.ts:123` (`anthropic-beta: prompt-caching-2024-07-31` + cached `system` block `cache_control: ephemeral`); no env flag needed. System prompts per vertical (`src/lib/ai/prompts.ts:18` `EXTRACTION_SYSTEM_PROMPT`, `src/lib/ai/prompts.ts:44` `RISK_ANALYSIS_SYSTEM_PROMPT`, etc.) are ~300-520 tokens each and benefit after first call per vertical (cached input 90% off: $0.30 vs $3.00 per 1M).

## Checklist

1. Create Vercel project and connect GitHub repo `Arem-ee/Dealenz` branch `consultant-phase-3-pricing` (or `master` after merge).
2. Add each variable above in Vercel → Environment Variables (Production).
3. Deploy.
4. Set `NEXT_PUBLIC_APP_URL` to the actual Vercel URL after first deploy, redeploy.
5. Configure Paddle webhook destination to `https://<your-app>/api/billing/webhook` with the same `PADDLE_WEBHOOK_SECRET`.
6. Return with the live URL.
