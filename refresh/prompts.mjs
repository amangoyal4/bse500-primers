// refresh/prompts.mjs
// PURPOSE: the primer must read as an accurate PRESENT-TENSE profile for someone meeting the
// company for the FIRST TIME. It is NOT a changelog. The refresh RE-TRUES the primer to today —
// rewriting the affected passages/numbers in place as natural current-state prose.
//
// The model READS facts (BSE Reg-30 filings + reliable news, see sources.mjs); it never invents.

// Few-shot: a development the scan found, and how the AFFECTED passage should now READ.
export const EXEMPLAR = {
  found: {
    headline: 'NRL 3->9 MTPA expansion mechanically complete; commissioning in H1 FY27',
    date: '2026-07-01',
    decoded: 'Numaligarh Refinery (Oil India ~69.6%) reported the tripling to 9 MTPA as mechanically ready; ~Rs 34,000 crore project; commissioning now scheduled for H1 FY27.',
  },
  // present-tense primer prose — no "recently / update / now announced", the reason baked in only where it matters:
  rewritten: 'NRL is the crown jewel — its tripling to 9 MTPA, a ~Rs 34,000 crore project, is mechanically complete and commissioning in H1 FY27, adding the refining-margin stream that cushions Oil India\'s upstream cycle.',
};

// --- retrieval-classification (over REAL feed items) ---
export function classifyPrompt(stock, feedItems, since, today) {
  return `You are an equity-research analyst for ${stock.name} (NSE: ${stock.nse}). Below are REAL items from the BSE filing feed and Google News between ${since} and ${today} (JSON): ${JSON.stringify(feedItems)}

Cluster them into distinct real-world developments (merge the filing and the news about the same event). For each, note if it could change how the company would be DESCRIBED to a first-time reader (its scale/financials, structure/business mix, strategy, leadership, ownership, or regulatory standing). Drop routine noise.
Return STRICT JSON only: [{"date":"YYYY-MM-DD","category":"ownership|business|regulatory|capital|leadership|deal|shock","headline":"clear one-line","whatHappened":"1-2 sentences from the items","sources":["url"]}] or [].`;
}

// Active grounded discovery — searched EVERY run across many angles (the feed alone misses things,
// and BSE is unreliable). One grounded call per angle.
export const FANOUT_QUERIES = [
  { key: 'acq', label: 'an acquisition of a company, business, or assets' },
  { key: 'merger', label: 'a merger, demerger, or scheme of arrangement' },
  { key: 'stake', label: 'a promoter or PE stake sale, block deal, open offer, or change of control' },
  { key: 'jv', label: 'a joint venture, strategic partnership, or a new strategic investor' },
  { key: 'divest', label: 'a divestment, asset sale, or exit from a business' },
  { key: 'leader', label: 'a CEO, MD, or CFO appointment or resignation' },
  { key: 'govern', label: 'a board or auditor change, or a fraud / investigation / whistleblower issue' },
  { key: 'reg', label: 'a regulatory action (SEBI, RBI, CCI, USFDA, NCLT, or court), tariff, ban, or subsidy change' },
  { key: 'order', label: 'a large order win, major contract, or a tender award or loss' },
  { key: 'capex', label: 'a new plant, a major capacity expansion, or a new business line' },
  { key: 'product', label: 'a major new product, platform, or launch' },
  { key: 'fund', label: 'a fundraise, QIP, rights issue, or preferential allotment' },
  { key: 'rating', label: 'a credit-rating upgrade, downgrade, or default' },
  { key: 'result', label: 'quarterly or annual results, a profit warning, or a change in guidance' },
  { key: 'shock', label: 'a plant fire, shutdown, product recall, data breach, or material litigation' },
];
export function fanoutPrompt(stock, since, today, query) {
  return `Using Google Search, find news reported between ${since} and ${today} about ${stock.name} (NSE: ${stock.nse}) relating to: ${query.label}. Credible source + URL required; no price moves or PR.
Return STRICT JSON only: [{"date":"YYYY-MM-DD","headline":"...","whatHappened":"1-2 sentences","source":"https://..."}] or [].`;
}

// Completeness critic — "what material development did we miss?"
export function completenessPrompt(stock, since, today, known) {
  return `Using Google Search, check whether any MATERIAL development for ${stock.name} (NSE: ${stock.nse}) between ${since} and ${today} is MISSING from this list of headlines already found: ${JSON.stringify(known)}. Material = M&A, change of control, business change, government/regulatory action, capital-structure change, leadership/governance shock, a step-change deal, or an operational shock. Ignore routine noise.
Return STRICT JSON only — any MISSING items: [{"date":"YYYY-MM-DD","headline":"...","whatHappened":"1-2 sentences","source":"https://..."}] or [].`;
}

export function corroboratePrompt(stock, item) {
  return `Using Google Search, verify this about ${stock.name} (NSE: ${stock.nse}): "${item.headline}" (${item.date}) — ${item.whatHappened}. Find an INDEPENDENT credible source (not among: ${(item.sources || []).join(', ') || 'none'}).
Return STRICT JSON only: {"confirmed":true|false,"date":"YYYY-MM-DD","whatHappened":"corrected 1-2 sentences","sources":["credible urls"]}.`;
}

export function contextPrompt(stock, item) {
  return `Using Google Search, pull the hard specifics behind this for ${stock.name}: "${item.headline}" (${item.date}). Numbers (deal size / stake % / order value / fine / rating notches), counterparties, status — only if reported.
Return STRICT JSON only: {"figures":"short phrase or empty","counterparties":"or empty","timeline":"or empty","sources":["urls"]}.`;
}

// decode the WHY/context — needed so the rewrite can carry material reasons (and drop routine ones)
export function impactDecodePrompt(stock, item) {
  return `Using Google Search, decode this development for ${stock.name}: "${item.headline}" (${item.date}) — ${item.whatHappened}${item.figures ? ` [figures: ${item.figures}]` : ''}
From credible sources, explain: what it means, the MAGNITUDE relative to the company (share of revenue/capacity/market cap), and — importantly — the REASON behind it and whether that reason is MATERIAL (e.g. forced exit / investigation / fraud / strategic shakeup / regulatory action / health) or ROUTINE (tenure completion / planned succession / ordinary course). Attribute to sources; don't speculate.
Return STRICT JSON only: {"significance":"2-3 sentences or empty","magnitude":"e.g. '~12% of FY26 revenue' or empty","reason":"the cause or empty","reasonMaterial":true|false,"sources":["urls"]}.`;
}

// Combined VERIFY + figures + reason in ONE grounded call (replaces corroborate+context+decode).
export function verifyPrompt(stock, item) {
  return `Using Google Search, verify and enrich this development about ${stock.name} (NSE: ${stock.nse}): "${item.headline}" (${item.date}) — ${item.whatHappened}
Find at least one INDEPENDENT credible source, then pull the specifics and the cause.
Return STRICT JSON only: {"confirmed":true|false,"date":"YYYY-MM-DD","whatHappened":"corrected 1-2 sentences","figures":"key numbers EXACTLY as a source states them, or empty","reason":"the cause, or empty","reasonMaterial":true|false,"sources":["credible urls"]}.
confirmed=false if no credible source. Report ONLY figures a source actually states — never compute, estimate, or convert a number.`;
}

// Combined materiality — all three lenses in ONE call (replaces the 3 separate lens calls).
export function materialityPrompt(stock, items) {
  return `A first-time reader is meeting ${stock.name}. Thesis: ${stock.thesis || '(none)'}
Developments (JSON): ${JSON.stringify(items.map((it, i) => ({ i, headline: it.headline, whatHappened: it.whatHappened })))}
For EACH: would the primer be INACCURATE or INCOMPLETE for a newcomer if it did NOT reflect this — across any of three lenses: (a) the company's scale / financial profile, (b) its structure / business mix / ownership / strategy, (c) its leadership / governance / regulatory standing? Material if ANY lens clearly applies. Default "no".
Return STRICT JSON only: {"verdicts":[{"i":<index>,"changesDescription":true|false}]}.`;
}

// materiality = "does this change how the company should be DESCRIBED today?" (positioning, not events)
export const MATERIALITY_LENSES = [
  { key: 'scale', label: "the company's described SCALE or financial profile (revenue, margins, capacity, valuation)" },
  { key: 'structure', label: "the company's described STRUCTURE, business mix, ownership, or strategy" },
  { key: 'standing', label: "the company's described LEADERSHIP, governance, or regulatory standing" },
];
export function materialityLensPrompt(stock, items, lens) {
  return `A first-time reader is meeting ${stock.name}. Judge ONLY through this lens: ${lens.label}.
Thesis: ${stock.thesis || '(none)'}
Developments (JSON): ${JSON.stringify(items.map((it, i) => ({ i, headline: it.headline, whatHappened: it.whatHappened })))}
For EACH: would the current primer be INACCURATE or INCOMPLETE for a newcomer if it did NOT reflect this — through this lens? Default "no".
Return STRICT JSON only: {"verdicts":[{"i":<index>,"changesDescription":true|false}]}.`;
}

// SYNTHESIS = re-true the primer with the SMALLEST possible surgical edits.
// sections: [{id, html}] (current inner HTML of each numbered section). Output = find/replace ops.
export function synthesisPrompt(stock, sections, developments) {
  return `You maintain a primer that reads as an accurate, PRESENT-TENSE profile of ${stock.name} (NSE: ${stock.nse}) for someone meeting it for the FIRST TIME. Your job is to make the SMALLEST possible surgical edits so it is true to the present — nothing more.

CURRENT SECTIONS (JSON [{id, html}]): ${JSON.stringify(sections)}
VERIFIED, DECODED DEVELOPMENTS (JSON — the ONLY facts you may use): ${JSON.stringify(developments)}

Produce find/replace edits. For each: copy the EXACT smallest substring of a section's html that is now stale into "find" (verbatim, character-for-character, HTML and all, as it appears above), and put the minimal corrected text in "replace".

HARD RULES — breaking any one is a failure:
1. Touch ONLY a section whose subject IS the development. NEVER edit foundational/explainer sections or any prose the development doesn't directly make stale.
2. Change the FEWEST words possible — ideally one clause or one number. Keep every other character identical. Do not re-paragraph, re-order, restyle, or expand.
3. NEVER introduce a number, date, name, or fact that is not explicitly in the developments above. Do NOT compute, estimate, convert, or infer figures (no market caps, ratios, %-of-revenue, or currency conversions you weren't given). If you don't have a figure, don't state one.
4. PRESERVE existing precision. Never make a figure less precise (e.g. don't turn ₹26,850 Cr into ₹26,000 Cr) and never flip a figure to a differently-sourced-but-credible value.
5. Present-tense, no changelog voice ("recently/update/now announced"). Include a change's reason only if reasonMaterial is true; routine reasons → fact only.
6. When in doubt, DON'T edit. Fewer edits is better. A primer that's already accurate needs zero edits.
Voice for any replacement text — DEVELOPMENT: ${JSON.stringify(EXEMPLAR.found)} → REWRITTEN CLAUSE: ${JSON.stringify(EXEMPLAR.rewritten)}
If a development is transformational (demerger, change of control, business-model change), set bigChange=true with rebuildReason instead of editing.

Return STRICT JSON only:
{"status":"updates","edits":[{"id":"<section id>","find":"<exact verbatim substring>","replace":"<minimal new text>"}],"statUpdates":[{"k":"<stat key>","v":"<new value only if given>"}],"bigChange":false,"rebuildReason":""}.
If the primer is already accurate, return {"status":"current","edits":[]}.`;
}

export function critiquePrompt(stock, draft, developments) {
  return `Final gate on these surgical find/replace edits for ${stock.name} (JSON): ${JSON.stringify(draft)}
The ONLY facts allowed (JSON): ${JSON.stringify(developments)}
DELETE any edit whose "replace" contains a number, date, name, or fact NOT explicitly in the facts above (especially computed/estimated/converted figures like market caps, ratios, or currency conversions). DELETE any edit that touches a section not directly about a development, that changes more than the minimal stale clause, that makes a figure less precise, that swaps a figure for another credible source's value, or that reads like a changelog. Keep only genuinely-needed, minimal, present-tense edits.
Return the CLEANED result in the SAME JSON shape, or {"status":"current","edits":[]} if nothing should change.`;
}
