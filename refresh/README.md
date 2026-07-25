# Refresh — feed-driven, max-quality "what changed" pipeline

Fully **self-contained on free tiers** — no Claude/Opus, nothing that can disconnect. Built so
the only human action is clicking refresh. Scoped to **≤ 5 stocks/day** so each one is
researched hard.

## The idea that makes it good, not just "good for Flash"
The model never *guesses* what changed — it **reads the company's own filings**. Indian listed
companies must disclose every material event to the exchange (SEBI LODR Reg 30). That filing
feed is the authoritative list of what happened, and it's free.

```
FREE FEEDS (truth spine)                 FREE MODELS (read + judge, never invent)
  BSE corp announcements (Reg-30) ─┐       classify  → Flash
  Google News RSS (context) ───────┴──►    corroborate + figures → Flash + Google Search
                                           materiality panel → Flash + Flash-Lite (6 judges)
                                           write + critique → Pro if free, else Flash (few-shot)
```

### Pipeline (per stock)
1. **Retrieve** — BSE Reg-30 filings (by the BSE code we store for all companies) + Google News RSS. Free, no key, no model.
2. **Classify** — Flash clusters filings + news into candidate developments (BSE items arrive pre-categorised).
3. **Corroborate + figures** — grounded Google Search confirms each item against an independent source and pulls the hard numbers (deal size, stake %, order value…). BSE filings are kept even if a search doesn't add a second source — they're authoritative.
4. **Materiality panel** — Flash *and* Flash-Lite each judge every item through 3 lenses (earnings / competitive / ownership-control). 6 votes; a majority keeps it. Ensemble = a stable judge out of weak ones.
5. **Dedupe** vs the primer.
6. **Synthesis + self-critique** — try free Gemini 2.5 Pro for the write-up, fall back to Flash on quota. Few-shot with a real primer excerpt so the prose matches the primer voice.

Most refreshes return `status:"no-material-change"` — the quiet is the feature. A transformational
event sets `bigChange:true` → signal to rebuild the whole primer.

### Why this is close to Opus for THIS task
- Recall + accuracy come from **filings**, not model memory → near-zero hallucination.
- Reliability comes from the **ensemble vote**, not one smart call.
- Voice comes from **few-shot** on the primers themselves.
- The residual gap (subtle judgment, last-mile prose) is opportunistically covered by free **Pro** when its quota allows, Flash otherwise. Nothing breaks if Pro is unavailable.

## Files
- `sources.mjs` — free retrieval (BSE announcements API + Google News RSS), fail-soft to [].
- `prompts.mjs` — classify / corroborate / context / 3 materiality lenses / dedupe / synthesis / critique, plus the few-shot exemplar.
- `pipeline.mjs` — orchestrator, model ensemble, Pro→Flash fallback, grounded-budget guard. Never throws.
- `schema.mjs` — the delta contract + `validateDelta()` (a bad model reply can't render a broken card).
- `run-one.mjs` — CLI to test one stock.

## Test (needs your key)
```bash
GEMINI_API_KEY=your_key node refresh/run-one.mjs reliance-industries 2026-06-01
```

## Grounding budget
Retrieval is free (feeds), so grounded calls are spent only on corroboration/figures — roughly
2 per candidate. A normal stock uses ~5–20 grounded calls, so 5 stocks stay far under the ~500/day
free cap, with a hard guard (`CONFIG.dailyGroundedBudget = 450`) that degrades gracefully.

## Wiring (needs your key + accounts — next step)
- **Scheduled**: a GitHub Action runs `scanBatch([...≤5 stocks...])` and commits each delta to
  `data/developments/<slug>.json` (same git flow as the primers). Key = Actions secret `GEMINI_API_KEY`.
- **Password button**: a small Cloudflare Worker holds the key + password, verifies server-side,
  runs `scanStock` on demand, and returns the delta the refresh UI renders.
- Use a **dedicated Gemini key/project** so the 500/day grounding isn't shared with Guardian Times.

## Honest limit
It finds what filings + press have **reported**. A truly unreported event won't surface — but for
Indian listed companies, Reg-30 makes that rare, because the company is legally obliged to file it.
