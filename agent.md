# Dealenz — Agent Instructions

For any AI coding agent (Claude Code, Codex, Gemini CLI, OpenCode, etc.)
working in this repo. Read `product.md` and `architecture.md` first for
context — this file is about how to work in the codebase, not what it
does.

## Ground rules
1. **No assumptions presented as fact.** If you haven't read the actual
   file, don't state what it does. If something is ambiguous or you
   can't verify it, say so explicitly — mark it UNVERIFIED rather than
   guessing and moving on.
2. **Cite file:line for any claim about current behavior**, the same way
   the 2026-08-29 audit did. This makes your output checkable instead of
   trusted blindly.
3. **Don't claim something is "done" without showing proof.** Run the
   build, run the typecheck, show the actual output. "Should work" is not
   a completion state.
4. **Don't touch `src/lib/ai/prompts.ts` casually.** The extraction and
   risk prompts are tuned for structured JSON output and referenced by
   multiple downstream parsers (`extractJson`, `transformGeminiOutput`).
   Changes here have wide blast radius — test against a real deal input
   before considering a prompt change complete.

## Things that will bite you if you don't know them
- **`src/proxy.ts` is not `middleware.ts`.** Next.js convention expects
  the latter for route-guard/session-refresh logic to run automatically.
  Whether this file is actually wired in correctly is unverified as of
  the last audit. If you're touching auth, routing, or session handling,
  confirm this runs before assuming it does.
- **Env var naming is currently misleading.** `GEMINI_API_KEY` in
  `.env.local` may hold a non-Gemini key (budget constraint, temporary).
  Check `.env.example` and the actual provider config before assuming
  the key name matches the key's actual provider.
- **No test script exists yet** despite Vitest being installed
  (`package.json` has no `"test"` entry). If you add tests, also wire the
  script — untested code with no way to run the tests is worse than no
  tests, since it looks covered and isn't.
- **RLS is load-bearing.** Every table has Row Level Security scoped to
  `auth.uid()`. Don't add a query path that bypasses RLS (e.g. a new
  `SECURITY DEFINER` function) without deliberately reasoning about who
  can call it — the two existing `SECURITY DEFINER` RPCs are narrowly
  scoped to the public share/sign flow on purpose.
- **Document generation is 4 sequential AI calls per package**
  (proposal → SOW → contract → checklist), each with its own timeout and
  its own template fallback. If a call fails partway, know which
  documents you'll have and which you won't — don't assume all-or-nothing.

## Code conventions
- **No comments in the codebase.** Code should be self-explanatory
  through naming and structure. If a piece of logic genuinely needs
  explanation, that's usually a sign it should be simplified or broken
  into a clearer function, not commented.
- **No em dashes** in code, commit messages, UI copy, or docs generated
  for this project. Use a period, comma, or parentheses instead.
- **No hallucinated APIs, functions, or config.** If you're not certain
  a method, package, or environment variable exists, verify it against
  the actual dependency (check `node_modules`, the package's types, or
  its docs) before using it. Don't pattern-match to a similar library
  and assume the API matches.
- **No hallucinated claims about the codebase.** Same rule as the "ground
  rules" section above, restated as a code-level habit: don't describe
  what a function does without having read it.

## Before marking any task complete
- `npm run build` — must pass
- `npx tsc --noEmit` — must show zero errors
- If you touched AI call paths: make one real call with real input and
  show the actual response, not a description of expected behavior
- If you touched auth or RLS: state explicitly what you verified and how

## Workflow expectations
Given the way this project is built — a solo builder directing AI agents
rather than writing most code by hand — treat every output as something
that needs to survive a human skim-review, not a deep line-by-line audit.
That means:
- Prefer clear, boring, well-cited changes over clever ones
- Flag anything genuinely uncertain rather than picking a plausible
  answer and presenting it with confidence
- When a fix touches security, auth, or money (rate limits, billing),
  say so explicitly and explain the reasoning, even briefly — these are
  the places where a wrong assumption costs the most.
