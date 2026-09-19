# Dealenz Strategic Phase Pipeline

Owner's source of truth. Supersedes roadmap assumptions in `product.md` /
`architecture.md` where they conflict; those files remain implementation
references, not direction. Updated when evidence changes my mind.

## 1. Product thesis

Most people sign paper they did not write and cannot fully read. Lawyers are
correct but slow and expensive; generic AI is fast but unaccountable. Dealenz
owns the middle: **the counterparty-side rescue loop** — take their contract,
show exactly what to push back on and in what words, re-check the redline,
sign in the same room, and guard what was agreed afterwards.

One sentence: **Send us their contract. Get back what to push back on. Sign here. Stay guarded.**

## 2. Target users (ordered)

1. **Freelancers and solo operators receiving client paper** — monthly frequency,
   clear pain, proven $3–15/deal price band, zero competition at the bottom.
2. **5–50-person firms with signed-contract exposure** — renewals, obligations,
   notice windows. Retention and subscription revenue live here.
3. **Nigeria-corridor and multi-jurisdiction deals** — US/UK/EU/NG coverage nobody
   else bothers with. Moat, not core.
4. Founders/partnerships — served by existing coverage, not led. Lawyer network
   only after demand density exists (no two-sided build before then).

Anti-users: enterprise legal ops (Harvey/Ironclad territory), anyone wanting a
CRM, anyone wanting autonomous agents.

## 3. Core job (the loop)

```text
Their paper in → flags + evidence → counter-words → re-check → sign → obligations guarded
```

Everything must advance a deal along this loop. Work that does not is suspect.

## 4. Product boundaries (hard)

- Counterparty-first. Never drift into drafter/CLM/CRM territory.
- AI proposes, deterministic rules decide, humans approve consequential acts.
  No change without evidence this triad is insufficient.
- Credits price **deal outcomes**, not operations. No subscriptions, no plans,
  no feature gates by tier. No credits-as-money, no lawyer escrow, no funds held.
- No anonymous analysis (abuse + trust). No managed-review margins, no sales
  motion. Self-serve or nothing.
- No feature that cannot be explained in one sentence on the landing page.

## 5. Experience principles

Composer-first, work-dominant surfaces. One account entry point (navbar).
Sidebar stays two items. No teaching UI — the classifier routes typing.
Every claim on screen traces to evidence or says unknown. Empty states tell
the user the next action, not the product story. Mobile is a first-class
single-column product, not a shrunk desktop.

## 6. Business model

Per-deal value, credit rails underneath:
- Free: daily analyses + 10-credit signup grant (acquisition).
- Pay per deal outcome (analysis → docs → sign as one visible price path).
- Recurring: obligation/renewal guard subscriptions for firms (to be built;
  the only recurring-shaped value — do not fake it before it exists).
- Lawyer reviews: fixed-fee, 20% platform cut, connected accounts only.
- Unit economics: measure real token cost per deal type for one week before
  freezing any price. Never price Ask above a micro-deal.

Distribution (in order): SEO on deal-scared queries, shareable finding
reports, email-forward intake, embeds where deals arrive. No paid CAC until
LTV is measured.

## 7. Technical direction

- Keep: deterministic rules authority, evidence model, advisory-locked ledger,
  RLS discipline, approval gates, jurisdiction honesty, split-pane work
  surfaces, provider-agnostic AI layer.
- Fix: extraction fidelity (conflicting terms collapse — top correctness risk),
  4-sequential-AI-calls (queue/background), silent AI fallbacks (alert, don't
  just log), dependency vulnerabilities.
- Build: counter-language + redline re-check, notice-deadline extraction at
  signing, renewal/obligation guard UX, outcome-data collection
  (flag→action→accepted, lawyer overturns) as the only flywheel that matters.
- Remove: duplicate routers (`consultant/`, `proposals/`, `deal/`), hardcoded
  template list, batch-outreach demo-ware, lifecycle breadth with no depth.
- Docs: shrink by two-thirds; code + migrations are truth.

## 8. Phases (each ends in a user-visible deal outcome)

- **P1 — Rescue loop core (current):** landing tells the loop story; analysis →
  counter-words → re-check → sign works end-to-end on freelance + founder
  verticals. Validation: real user completes scared-paper → signed, no staff help.
- **P2 — Close the loop:** notice-deadline extraction at signing; counterparty
  memory across deals (what they pushed last time); per-deal bundle pricing
  visible up front.
  Validation: users return for deal #2 without prompting.
- **P3 — Renewal guard:** inbox import → obligation repository → deadline
  alerts → firm subscription. Validation: first saved auto-renewal + paying
  subscriber who never ran an analysis.
- **P4 — Corridor moat:** NG/US/UK/EU playbook depth, Paystack-native billing,
  outcome-data-driven rule improvement. Validation: corridor users convert
  above baseline.
- **P5 — Lawyer density (only then):** fixed-fee reviews on top of proven
  demand. Validation: review attach rate without discounting.

Dependencies: P2 needs extraction fidelity fixed. P3 needs Gmail reliability
proven. P5 needs P1 volume. Nothing starts without its validation gate met.

## 9. What success means

Someone receives hostile paper on a Tuesday, runs it through Dealenz, pushes
back with our words, signs here, and never thinks about the renewal date
again — because we do. Then they come back with the next one, and tell
another freelancer. Measured in completed rescue loops, returning deal count,
and renewals guarded — not features shipped.
