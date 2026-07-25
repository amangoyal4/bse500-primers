// refresh/pipeline.mjs
// Keeps a primer TRUE TO THE PRESENT for a first-time reader. Self-contained, free-tier only.
// Reads real BSE Reg-30 filings + news (sources.mjs), judges whether anything changes how the
// company should be DESCRIBED today, and returns in-place EDITS that re-true the affected
// passages/numbers. Never a changelog. Never hard-fails.

import { fetchBseAnnouncements, fetchGoogleNews } from './sources.mjs';
import {
  classifyPrompt, FANOUT_QUERIES, fanoutPrompt, completenessPrompt,
  corroboratePrompt, contextPrompt, impactDecodePrompt,
  MATERIALITY_LENSES, materialityLensPrompt,
  synthesisPrompt, critiquePrompt,
} from './prompts.mjs';
import { validateDelta } from './schema.mjs';
import { guardEdits } from './apply.mjs';

const KEY = process.env.GEMINI_API_KEY;
const FLASH = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FLASH_LITE = 'gemini-2.5-flash-lite';
const PRO = 'gemini-2.5-pro';
const ENDPOINT = m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

export const CONFIG = {
  maxStocksPerDay: 5, dailyGroundedBudget: 450, perStockGroundedCap: 90, rpmPaceMs: 4200,
  corroboratePerItem: 2, contextPerItem: 1,   // deep, multi-source verification
  smartChain: [PRO, FLASH], ensembleModels: [FLASH, FLASH_LITE],
};

export function makeBudget(total = CONFIG.dailyGroundedBudget) {
  return { total, used: 0, get remaining() { return this.total - this.used; }, spend(n = 1) { this.used += n; } };
}
const pace = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => { if (process.env.QUIET !== '1') console.error('  ·', ...a); }; // progress → stderr (JSON stays clean on stdout)
const j = (t, f) => { try { return JSON.parse(t); } catch { const m = String(t).match(/[\[{][\s\S]*[\]}]/); if (m) { try { return JSON.parse(m[0]); } catch {} } return f; } };

async function gemini({ model = FLASH, prompt, grounding = false, json = false, temperature = 0.2 }) {
  if (!KEY) throw new Error('Set GEMINI_API_KEY');
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature } };
  if (grounding) body.tools = [{ google_search: {} }];
  else if (json) body.generationConfig.responseMimeType = 'application/json';
  const RETRYABLE = new Set([429, 500, 502, 503, 529]);
  let lastErr, wait = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (wait) await pace(wait);
    try {
      const res = await fetch(`${ENDPOINT(model)}?key=${KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { const d = await res.json(); return (d.candidates?.[0]?.content?.parts || []).map(p => p.text).filter(Boolean).join('\n'); }
      lastErr = new Error(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 160)}`);
      if (!RETRYABLE.has(res.status)) throw lastErr;                 // 400 / permission errors: don't retry
      wait = res.status === 429 ? 32000 : 4000 * (attempt + 1);     // 429 = rate limit → wait for the minute to clear
      log(`  (retry ${model} after ${res.status}, waiting ${Math.round(wait / 1000)}s…)`);
    } catch (e) { lastErr = e; wait = 5000; }                        // network error → short retry
  }
  throw lastErr;
}
async function smart(prompt, json = true) { for (const m of CONFIG.smartChain) { try { return await gemini({ model: m, prompt, json }); } catch {} } return ''; }
const flash = (prompt, json = true, model = FLASH) => gemini({ model, prompt, json });
async function grounded(budget, prompt) {
  if (budget.remaining <= 0) return '';
  budget.spend(1);
  try { const out = await gemini({ model: FLASH, prompt, grounding: true }); await pace(CONFIG.rpmPaceMs); return out; }
  catch { await pace(CONFIG.rpmPaceMs); return ''; }
}

// stock: { name, nse, bse, slug, thesis } ; sections: [{ id, html }] (current primer sections)
// Spends up to ~perStockGroundedCap grounded calls per stock (5 stocks stay under the ~500/day free cap).
export async function scanStock(stock, since, sections = [], budget = makeBudget()) {
  const today = process.env.RUN_DATE || new Date().toISOString().slice(0, 10);
  const current = validateDelta({ status: 'current' }, stock, today);
  const cap = makeBudget(Math.min(CONFIG.perStockGroundedCap, budget.remaining)); // per-stock grounded budget
  const g = prompt => grounded(cap, prompt);
  const done = () => { budget.spend(cap.used); };
  try {
    // 1) RETRIEVE — free feeds
    const [bse, news] = await Promise.all([
      fetchBseAnnouncements(stock.bse, since, today).catch(() => []),
      fetchGoogleNews(stock.name, since).catch(() => []),
    ]);
    log(`feeds: ${bse.length} filings, ${news.length} news`);

    // 2) ACTIVE grounded DISCOVERY across ~15 angles (feed alone misses things; BSE is unreliable)
    const discovered = [];
    for (const q of FANOUT_QUERIES) {
      const a = j(await g(fanoutPrompt(stock, since, today, q)), []);
      if (Array.isArray(a)) a.forEach(it => discovered.push({ date: it.date, headline: it.headline, whatHappened: it.whatHappened, sources: it.source ? [it.source] : [], src: 'search' }));
    }
    log(`discovery: ${discovered.length} hits across ${FANOUT_QUERIES.length} searches`);

    // 3) CLUSTER feed + discovery into candidates (plain)
    const rawAll = [
      ...bse.map(a => ({ date: a.date, headline: a.headline, whatHappened: a.detail || '', sources: a.source ? [a.source] : [], src: 'bse' })),
      ...news.map(n => ({ date: n.date, headline: n.headline, whatHappened: n.publisher || '', sources: n.source ? [n.source] : [], src: 'news' })),
      ...discovered,
    ];
    let candidates = rawAll.length ? j(await flash(classifyPrompt(stock, rawAll, since, today)), rawAll) : [];
    if (!Array.isArray(candidates)) candidates = rawAll;

    // 3b) completeness critic (grounded)
    if (candidates.length && cap.remaining > 0) {
      const miss = j(await g(completenessPrompt(stock, since, today, candidates.map(c => c.headline))), []);
      if (Array.isArray(miss)) miss.forEach(m => candidates.push({ date: m.date, headline: m.headline, whatHappened: m.whatHappened, sources: m.source ? [m.source] : [], src: 'critic' }));
    }
    if (!candidates.length) { done(); return current; }
    log(`${candidates.length} candidate development(s) — deep verifying…`);

    // 4) DEEP VERIFY per candidate: multi-source corroborate + figures + reason (grounded)
    const enriched = [];
    for (const item of candidates) {
      let cur = { ...item, sources: item.sources || [] };
      let ok = true;
      for (let k = 0; k < CONFIG.corroboratePerItem && cap.remaining > 0; k++) {
        const v = j(await g(corroboratePrompt(stock, cur)), null);
        if (!v) break;
        if (!v.confirmed) { ok = false; break; }
        cur = { ...cur, date: v.date || cur.date, whatHappened: v.whatHappened || cur.whatHappened, sources: [...new Set([...(cur.sources || []), ...(v.sources || [])])] };
      }
      if (!ok && item.src !== 'bse') continue; // unconfirmed & not a filing → drop
      if (cap.remaining > 0) { const c = j(await g(contextPrompt(stock, cur)), null); if (c) cur = { ...cur, figures: c.figures, sources: [...new Set([...(cur.sources || []), ...(c.sources || [])])] }; }
      if (cap.remaining > 0) { const d = j(await g(impactDecodePrompt(stock, cur)), null); if (d) cur = { ...cur, significance: d.significance, magnitude: d.magnitude, reason: d.reason, reasonMaterial: !!d.reasonMaterial, sources: [...new Set([...(cur.sources || []), ...(d.sources || [])])] }; }
      enriched.push(cur);
    }
    if (!enriched.length) { done(); return current; }

    // 5) DOES-IT-CHANGE-THE-DESCRIPTION panel — 2 models x 3 lenses, majority (plain)
    const votes = enriched.map(() => 0);
    for (const model of CONFIG.ensembleModels) for (const lens of MATERIALITY_LENSES) {
      const r = j(await flash(materialityLensPrompt(stock, enriched, lens), true, model), { verdicts: [] });
      (r.verdicts || []).forEach(v => { if (v && typeof v.i === 'number' && enriched[v.i] && v.changesDescription) votes[v.i]++; });
    }
    const threshold = Math.ceil((CONFIG.ensembleModels.length * MATERIALITY_LENSES.length) / 2);
    const changing = enriched.filter((_, i) => votes[i] >= threshold);
    log(`${changing.length} of ${enriched.length} change how the company is described`);
    if (!changing.length) { done(); return current; }

    // 6) SYNTHESIS -> surgical edits, then CRITIQUE (smart chain: Pro -> Flash)
    log('writing surgical edits…');
    const draft = j(await smart(synthesisPrompt(stock, sections, changing)), null);
    if (!draft || (!(draft.edits || []).length && !(draft.statUpdates || []).length)) { done(); return current; }
    const final = j(await smart(critiquePrompt(stock, draft, changing)), draft);
    if (final && Array.isArray(final.edits)) {
      const guard = guardEdits(final.edits, sections, changing);   // code-level safety — no human review needed
      if (guard.dropped.length) log(`guard dropped ${guard.dropped.length} edit(s): ${guard.dropped.join(', ')}`);
      final.edits = guard.kept;
    }
    done();
    return validateDelta(final, stock, today);
  } catch (e) {
    done();
    return { ...current, error: String(e).slice(0, 200) };
  }
}

// stocks: [{ name, nse, bse, slug, thesis, since, sections }]
export async function scanBatch(stocks) {
  const list = stocks.slice(0, CONFIG.maxStocksPerDay);
  const budget = makeBudget();
  const deltas = [];
  for (const s of list) { deltas.push(await scanStock(s, s.since, s.sections || [], budget)); if (budget.remaining <= 0) break; }
  return { asOf: process.env.RUN_DATE || new Date().toISOString().slice(0, 10), groundedUsed: budget.used, deltas };
}
