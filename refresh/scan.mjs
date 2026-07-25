// refresh/scan.mjs — CI entry. Re-trues up to 5 watchlist primers to the present, IN PLACE.
// Writes the updated primer files + a run log; the workflow opens a PR for review.

import { readFileSync, writeFileSync } from 'node:fs';
import { scanStock, makeBudget, CONFIG } from './pipeline.mjs';
import { parsePrimerSections } from './sources.mjs';
import { applyDelta } from './apply.mjs';

const root = new URL('../', import.meta.url);
const primers = JSON.parse(readFileSync(new URL('data/primers.json', root))).companies || [];
const watch = JSON.parse(readFileSync(new URL('refresh/watchlist.json', root)));
const today = new Date().toISOString().slice(0, 10);
const budget = makeBudget();
const log = [`Refresh run ${today}`];

for (const w of (watch.stocks || []).slice(0, CONFIG.maxStocksPerDay)) {
  try {
    const p = primers.find(c => (c.file && c.file.includes('/' + w.slug + '.')) || c.slug === w.slug);
    if (!p) { log.push(`${w.slug}: not in primers.json — skipped`); continue; }
    const file = new URL('primers/' + w.slug + '.html', root);
    const html = readFileSync(file, 'utf8');
    const sections = parsePrimerSections(html);
    const since = w.lastRefreshed || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const stock = { name: p.name, nse: p.nse, bse: p.bse, slug: w.slug, thesis: `${p.hook || ''} ${(p.tags || []).join('; ')}` };

    const delta = await scanStock(stock, since, sections, budget);
    if (delta.status === 'updates' && (delta.edits || []).length) {
      const { html: updated, applied, notes } = applyDelta(html, delta);
      if (applied) writeFileSync(file, updated);
      log.push(`${w.slug}: ${applied} passage(s) re-trued${delta.bigChange ? ' [BIG CHANGE — consider a full rebuild]' : ''}${notes.length ? ' (' + notes.join('; ') + ')' : ''}`);
    } else if (delta.error) {
      log.push(`${w.slug}: error — ${delta.error}`);
    } else {
      log.push(`${w.slug}: already current, no change`);
    }
    w.lastRefreshed = today;
    if (budget.remaining <= 0) { log.push('grounded budget spent — stopping early'); break; }
  } catch (e) {
    log.push(`${w.slug}: failed — ${String(e).slice(0, 160)}`);
  }
}

writeFileSync(new URL('refresh/watchlist.json', root), JSON.stringify(watch, null, 2) + '\n');
console.log(log.join('\n'));
