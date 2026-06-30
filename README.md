# BSE 500 — Business & Industry Primers

A growing library of deep, plain-English **business primers** for the BSE 500 —
how each company actually works: its value chain, the forces that move it,
financials, and a bull/bear view. Written for a non-specialist reader.

**Live site:** https://amangoyal4.github.io/bse500-primers/

## What makes these different

- **Bespoke sections per company.** No fixed template — each primer leads with
  what actually matters for that business (China & tariffs for a solar maker,
  demographics for a hospital chain, the AI question for an IT-services firm).
- **Hand-crafted quality, at the Rainbow standard.** Every primer is researched
  and written to the bar set by `primers/rainbow-childrens-medicare.html`. See
  [`RECIPE.md`](RECIPE.md) for the exact standard.
- **Verification-gated.** A primer publishes only if its key figures are
  confirmed against public sources; anything that can't clear the bar is held,
  not shipped.

## Structure

```
index.html              Catalog / landing page (search + sector filter)
primers/<slug>.html     One self-contained primer per company
data/primers.json       Catalog the landing page reads
data/worklist.json      The 500, ranked largest-first, with build status
data/constituents.csv   Source universe (Nifty 500 as a working BSE 500 proxy)
RECIPE.md               The quality standard every primer must match
```

## How the library grows

Primers are produced by scheduled, unattended Claude runs — **6 companies every
5 hours, largest market-cap first** — each following [`RECIPE.md`](RECIPE.md) and
auto-publishing what clears the verification gate. Full coverage of 500 takes
~2–3 weeks of runs.

## Roadmap

- **Phase 1 (now):** the hosted library + a dormant "⟳ Update" button on each
  primer (UI only).
- **Phase 2 (later):** wire the update button to a free Cloudflare Worker +
  GitHub Action so a click refreshes a single company on demand.

## Local preview

```bash
npx http-server . -p 4173 -c-1
# open http://localhost:4173
```

## Disclaimer

These primers are educational, plain-English explainers compiled from public
sources. They are **not investment advice**. Figures are approximate and may be
outdated — verify against primary sources before relying on them.
