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
| `AI_BASE_URL` | Provider docs (e.g. `https://integrate.api.nvidia.com/v1` or `https://generativelanguage.googleapis.com/v1beta`) | Server-only |
| `AI_MODEL` | Provider model catalog | Server-only |

### AI — authenticated Deal Intelligence

| Variable | Where to obtain | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Console → API Keys | Server-only. Required when `AUTH_AI_PROVIDER` is `anthropic` (default). |

### Paddle (software commerce — Merchant of Record)

| Variable | Where to obtain | Notes |
|---|---|---|
| `PADDLE_API_KEY` | Paddle Dashboard → Developer Tools → Authentication | Server-only. Live or sandbox key. |
| `PADDLE_WEBHOOK_SECRET` | Paddle Dashboard → Developer Tools → Notifications → Destination secret | Server-only. Verifies `Paddle-Signature`. |
| `PADDLE_PRICE_STARTER` | Paddle Dashboard → Catalog → Product → Price ID | Server-only. Price for 50-credit Starter. |
| `PADDLE_PRICE_STANDARD` | Paddle Dashboard → Catalog → Product → Price ID | Server-only. Price for 150-credit Standard. |
| `PADDLE_PRICE_PRO` | Paddle Dashboard → Catalog → Product → Price ID | Server-only. Price for 400-credit Pro. |

All other variables (`AUTH_AI_PROVIDER`, `AUTH_AI_MODEL`, `PADDLE_ENVIRONMENT`, `LEGAL_RESEARCH_LIVE`, `LEGAL_SEARCH_API_KEY`, `OPS_ALERT_WEBHOOK`, `GEMINI_*`) are optional and not required for baseline production. Set them only if you intend to override defaults.

## Checklist

1. Create Vercel project and connect GitHub repo `Arem-ee/Dealenz` branch `consultant-phase-3-pricing` (or `master` after merge).
2. Add each variable above in Vercel → Environment Variables (Production).
3. Deploy.
4. Set `NEXT_PUBLIC_APP_URL` to the actual Vercel URL after first deploy, redeploy.
5. Configure Paddle webhook destination to `https://<your-app>/api/billing/webhook` with the same `PADDLE_WEBHOOK_SECRET`.
6. Return with the live URL.
