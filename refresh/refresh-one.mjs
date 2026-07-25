// refresh/refresh-one.mjs — on-demand refresh of ONE primer, applied in place.
// Called by the refresh-one workflow: `node refresh/refresh-one.mjs <slug>`.
// Writes the file ONLY when a passage genuinely changes, so a "no material change"
// click produces no commit (the quiet is the feature). Never fails the workflow on a
// model/quota error — it just reports and exits 0.

import { readFileSync, writeFileSync } from 'node:fs';
import { scanStock, makeBudget } from './pipeline.mjs';
import { parsePrimerSections } from './sources.mjs';
import { applyDelta } from './apply.mjs';

const slug = process.argv[2];
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('usage: node refresh/refresh-one.mjs <slug>');
  process.exit(1);
}

const root = new URL('../', import.meta.url);
const primers = JSON.parse(readFileSync(new URL('data/primers.json', root))).companies || [];
const p = primers.find(c => (c.file && c.file.includes('/' + slug + '.')) || c.slug === slug);
if (!p) { console.error(`slug "${slug}" not found in data/primers.json`); process.exit(1); }

const file = new URL('primers/' + slug + '.html', root);
let html = readFileSync(file, 'utf8');
const sections = parsePrimerSections(html);
const since = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
const stock = { name: p.name, nse: p.nse, bse: p.bse, slug, thesis: `${p.hook || ''} ${(p.tags || []).join('; ')}` };

const budget = makeBudget();
let delta;
try {
  delta = await scanStock(stock, since, sections, budget);
} catch (e) {
  console.error(`${slug}: pipeline threw — ${String(e).slice(0, 200)}`);
  process.exit(0); // don't fail CI on a transient model/network error
}

if (delta.status === 'updates' && (delta.edits || []).length) {
  const { html: updated, applied, notes = [] } = applyDelta(html, delta);
  if (applied) {
    html = updated;
    // bump the visible "Last refreshed <date>" marker only when we actually changed something
    html = html.replace(/(<b id="rb-when">)[^<]*(<\/b>)/, `$1${today}$2`);
    writeFileSync(file, html);
    console.log(`refreshed ${slug}: ${applied} passage(s) re-trued${delta.bigChange ? ' [BIG CHANGE — consider a full rebuild]' : ''}${notes.length ? ' (' + notes.join('; ') + ')' : ''}`);
  } else {
    console.log(`${slug}: delta had edits but none applied cleanly (guard held) — no change`);
  }
} else if (delta.error) {
  console.log(`${slug}: no update — ${String(delta.error).slice(0, 160)}`);
} else {
  console.log(`${slug}: already current — no material change`);
}
