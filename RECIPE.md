# Primer Recipe — the standard every run must match

**This file is the single source of truth for how an NSE 750 primer is built.**
Each scheduled run is a fresh Claude session with no memory of prior chats. Follow
this exactly. The quality bar is the hand-crafted exemplars in `primers/` —
especially `rainbow-childrens-medicare.html` (the style template, kept on disk
but not in the catalog), plus the published `reliance-industries.html` and
`hdfc-bank.html`. If your output is not as good as those, it does not ship.

---

## 0. The one rule

> **Publish Rainbow-quality, or do not publish that company at all.**

Fully unattended, auto-publish — but gated. If you cannot confirm a company's key
figures against a real source, you **do not** ship a shaky primer. You mark it
`held` in the worklist and move on. A gap in the library is fine; a wrong number
under the owner's name is not.

**Depth = coverage + explanation (NOT a word count).** The bar is: does it
*comprehensively cover* every important dimension of the business AND *explain the
mechanisms* in plain English — the "why it matters," not just the "what" — so a
non-expert truly understands it? Match the richness of the exemplars (the hand
originals run ~4,800–5,500 words of real content; go LONGER for multi-segment
companies — a conglomerate needs a proper section per business: e.g. ITC =
cigarettes + FMCG + hotels + agri + paperboards; M&M = SUVs + tractors + Tech
Mahindra + finance + EVs). Don't pad, but never skimp. A section that *names* a
thing without explaining how it works or why it matters is a failure — expand it.
**In a multi-company run, keep EACH company as rich as if it were the only one
you were writing; do NOT get terser as the run goes on** (the tail of a long
sequential run is where quality silently erodes — guard against it).

---

## 1. The fixed process (do every step, every company)

1. **Deep live research — 8+ searches/fetches.** Don't write from memory. Pull
   current, specific, sourced facts: latest quarterly + full-year results, the
   real revenue/PAT/margins, the business model, segment mix, ownership, recent
   news, the competitive set, and the regulatory/structural backdrop. Credits are
   not a constraint — research until you actually understand the business.
2. **Cross-check every figure.** Reconcile conflicting sources and use the
   authoritative one (e.g. for Rainbow, the latest investor results, not a stale
   "14 hospitals" figure). Prefer company filings / results / concall over
   third-party summaries. Note the source for each hard number.
3. **Find the bespoke sections.** Identify the 3–5 *defining* forces for THIS
   company — the thing an analyst leads with. Examples: China & tariffs (Waaree),
   demographics & birth rate (Rainbow), the AI question (eClerx), subsidy & gas &
   monsoon (Paradeep). **Never** stamp a fixed section list on every company.
4. **Write in the house style** (see §2). Plain English for a non-specialist.
   Include charts, tables, the flow/value-chain diagram, a timeline, mini-stats,
   and a bull/bear panel — whatever genuinely fits the business.
5. **Self-verify before publish.** Re-read every number against the source you
   pulled. Render-check the HTML (it must display, TOC anchors must resolve).
   Then apply the gate in §0.

---

## 2. House style spec (match the exemplars exactly)

- **Self-contained HTML** — one file per company in `primers/<slug>.html`, all CSS
  inline in a `<style>` block. No external CSS/JS except Google Fonts.
- **Back-home button** — immediately after `<body>`, include a fixed
  "← Stock Primers" link back to the catalog: `<a href="../index.html"
  class="sp-back" …>← Stock Primers</a>` (fixed top-right, dark pill, white text;
  copy the exact element from any existing primer). Every primer must have it.
- **Fonts:** `Sora` (headings), `Figtree` (body), `DM Mono` (labels/numbers).
- **Per-company theme palette — LIGHT background ALWAYS.** Every primer uses the
  same light look: a light `--paper` (~#F4–F6 range), white `--card`, dark `--ink`
  text. Vary ONLY the **accent** colours (`--brand`/`--gold`/accent vars) to fit
  the business (solar blues+gold for Waaree; clinical teal+amber for Rainbow;
  amber for Coal India). **NEVER a dark-mode / dark-background theme** — a dark
  page makes it inconsistent with the rest of the library. Each primer is distinct
  only via its accent, not its background.
- **Structure (mirror Rainbow):**
  - Sticky left **TOC** (`nav.toc`) listing the numbered sections.
  - **Cover** (`header.cover`): kicker tags (incl. `NSE: … · BSE: …`), an `<h1>`
    with an `<em>` accent phrase, a `dek`, a 4-cell `stat-strip`, and the
    **refresh bar** (see §4).
    - **CURRENCY RULE (binding) — the top `stat-strip` financial cells MUST be in
      ₹ (Rupees Crore / Lakh Crore), never USD.** This applies to revenue, PAT,
      EBITDA (absolute), market cap, order book, GTV/AUM and any headline money
      figure — even for IT/pharma exporters that report primarily in dollars
      (show ₹ revenue, e.g. `₹1,75,000 Cr`, not `$20.2 bn`). Use the company's
      OWN reported ₹ figure; do not naive-FX-convert if a ₹ number is published.
      The ONLY numbers that may stay in USD at the top are genuine per-unit
      industry-convention metrics — refining **GRM `$/bbl`**, crude realisation
      `$/bbl`, LME metal cost/realisation **`$/t`**. Dollar figures may still
      appear inside body prose/tables (e.g. USD revenue for context), just not as
      a headline `stat-strip` money cell. Percentages, tonnage, headcount, etc.
      are unaffected.
  - **Numbered sections** `00 … N` (`section.part` with `.pno` + `<h2>`), a
    `.part-sub`, a `.lead` paragraph, `ul.clean` lists, "In plain terms"
    callouts (`.plain`), `.tbl-wrap` tables, `.chart` bar charts, the `.flow`
    value-chain/funnel diagram, a `.timeline`, `.mini-stats`, and a `.bb`
    bull/bear panel.
  - **Sourced footer** (`footer.src`): a numbered source list + the disclaimer.
- **Common spine** (always present): `00 Snapshot` · `Company & owners` ·
  `Financials & valuation` · final `Future / risks / bull-bear`. Everything
  *between* is bespoke (§1.3). Aim for ~10–12 sections like the exemplars.
- Reuse the exact component class names from the exemplars so the look is
  consistent (`.plain`, `.bar-row/.track/.fill`, `.node/.arrow`, `.ms`, `.bb`,
  `.note`, `blockquote`, etc.).

---

## 3. Provenance & disclaimer (auto-published primers)

- Footer disclaimer (always): educational, plain-English, **not investment
  advice**, figures approximate / may be outdated, verify against primary sources.
- **No cover provenance line.** The old "Auto-generated · figures self-verified
  against public sources · not investment advice." line near the cover was
  **removed from all primers on 2026-07-25** at the owner's request — do NOT add
  it to new primers. (The footer disclaimer above is the only required
  not-investment-advice statement.)

---

## 3b. Download-PDF button + print header (every primer)

Every primer carries a **"⬇ Download PDF" button** (fixed pill, top-right, gold,
under the back-link) that calls `window.print()`, plus a print-only Guardian
Capital **logo header** (`.pdf-head`, `../assets/logo.png`) and a dedicated
`@media print` stylesheet (injected as `<style id="pdf-print-style">`). The print
CSS: shows the logo header on top, collapses the two-column layout to a single
aligned column, renders background colours, and **hides from the PDF** the TOC
sidebar, back-link, refresh bar, What's-new block, and the button itself. New
primers must include this block — reuse `scratchpad/add-pdf-button.mjs` (idempotent).

## 4. The refresh bar (DORMANT for now — Phase 2)

Include the refresh control in every primer (cover area), but **unwired**:
- A status badge + "Last updated <date>".
- An "⟳ Update" button whose handler currently shows *"Live updates coming
  soon."* (`REFRESH_ENDPOINT = ""`). Do **not** wire it to any API yet — Phase 2
  connects the Cloudflare Worker + Action. Keep the markup/script identical to
  Rainbow so the later wiring is a one-line change.

---

## 5. After writing each primer

1. Save to `primers/<slug>.html` (slug = kebab-case company name).
2. **Append an entry to `data/primers.json`** `companies[]`:
   `{ name, file, nse, bse, sector, accent, hook, tags[3], refreshed, status }`.
   - `hook` = one compelling sentence. `tags` = the 3 bespoke section themes
     (this is what surfaces the "different sections per company" on the catalog).
   - `sector` MUST be the **NSE official classification** — read it from the
     company's row in `data/worklist.json` (or `data/constituents.csv` "Industry"
     column). Use NSE's names exactly (e.g. "Oil Gas & Consumable Fuels",
     "Information Technology", "Capital Goods", "Fast Moving Consumer Goods"),
     NOT generic/Yahoo sectors like "Energy"/"Technology"/"Industrials".
   - `status`: `"gold"` for hand-reviewed exemplars; `"published"` for
     auto-generated that cleared the gate.
3. **Update `data/worklist.json`**: set the company's `status` to `done` (or
   `held` if it failed the gate), with the date.
4. Commit and push (the scheduler runs in the repo; push publishes to Pages).

---

## 6. Per-run loop (scheduled, every 5 hours, up to 6 companies)

**Generate AT MOST 2 COMPANIES CONCURRENTLY — never more (hard cap).** The owner
confirmed (2026-07-02) that running 2 primer agents at once does NOT compromise
per-primer quality — each subagent researches, cross-checks, and writes its own
primer in isolation, so concurrency doesn't dilute any single one. You MUST still
fully verify AND publish each primer individually (the §0 gate applies per primer).
Do NOT exceed 2 in flight: an earlier 7-concurrent run overloaded the runner and
stalled agents at the watchdog. 1-at-a-time is always safe; 2 is the approved max
for speed; 3+ is forbidden.

```
read data/worklist.json
take the next pending company (worklist is pre-sorted: largest first)
repeat up to 6 times, time-boxed within the 5h window:
    COMPANY = next pending
    run §1 fully: research → cross-check → bespoke sections → write → self-verify
    re-read the finished primer end-to-end; confirm it matches the Rainbow bar
    if it clears the §0 gate: append to primers.json, mark done, commit + push
    else: mark held, log why
    only then move to the next company
write a short run log to runs/<date>.md (companies done / held + notes)
```

Target up to 6 per run, but **quality over count** — ship fewer rather than rush
one below the bar. One excellent primer beats six rushed ones. Never publish
half-finished work. Never repeat a company already `done`.
---

## 7. Anti-boilerplate guardrails (MANDATORY — added 2026-07-13 after a drift audit)

The house STRUCTURE is deliberately shared (snapshot → industry-101 → who-controls-it
→ bespoke crux → financials/valuation → risks/bull-bear). That is fine and intended.
What must NOT homogenize is the PROSE. A quality audit found the "connective tissue"
(closing lines, valuation rhetoric, voice tics) converging into a fill-in-the-blank
template across primers. Every new primer MUST obey these rules:

1. **Banned closing/valuation clichés** — do NOT use any of these phrases (they had become
   a verbatim template): "a long way to fall", "priced for perfection", "no room for error",
   "no margin for error", "leaves no room for error", "grow into its/the multiple",
   "call option on the future", and the seesaw "Get those right … stumble/disappoint, and …".
   Close the bottom-line on a COMPANY-SPECIFIC image or a concrete, NAMED next milestone
   (a specific plant commissioning, an order-award cadence, a margin gate, a court ruling)
   — never a generic valuation see-saw.

2. **Name the metric that settles the thesis, in this company's own terms.** The valuation
   section must point to the ONE specific, named number that will prove or break the case
   for THIS company (e.g. occupancy for a hospital, mid-cycle GRM for a refiner, contracted
   backlog for a defence-materials firm, ODM-mix % for a contract manufacturer, combined
   ratio for an insurer). Do NOT default every expensive stock to a "mix-shift / ramp /
   re-rate" arc or a "call option" framing. If a valuation section exists, the mandated
   bespoke section must NOT also be a valuation rant — spend it on real business mechanics.

3. **Cap the tic-words.** Use "honest/honestly" AT MOST ONCE in the whole primer. Do NOT use
   "the bull owns X; the bear owns Y", "both can be right at different moments",
   "both are true at once", or "the story will be written in [N] numbers each quarter".
   Vary the "In plain terms" box — do NOT open it with "Think of [Company] as…" (that opener
   is now overused; find a fresh way in). More broadly, do NOT use the "Think of it/[X] as …"
   construction ANYWHERE in the primer (not just as the opener) — it is a recurring crutch;
   rephrase every instance. Before finishing, grep your own draft for "think of" and remove it.

4. **One non-transferable device per primer (REQUIRED).** Include at least one analytical
   construct that could appear in NO other primer. Test every key sentence: "would this
   survive a find-replace of the company name?" If yes, it's boilerplate — rewrite it.
   Gold-standard example: MRPL's "same plant, same people, same 15 MMTPA — profit moved ~38×
   in two years; a ~$6/bbl GRM swing is the whole difference between a Rs 51 Cr and a
   Rs 1,931 Cr year."

5. **Force one genuine surprise.** Each primer must contain one insight that would SURPRISE a
   smart generalist about this specific company (a counter-intuitive fact, a hidden
   dependency, a structural quirk). This structurally blocks competent-but-templated output.

Bones excellent, mortar fresh. If a primer reads like it could be about any company in its
sector with the names swapped, it fails — rework it before publishing.
