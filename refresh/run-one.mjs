// refresh/run-one.mjs — re-true ONE primer to the present, print the in-place edits.
//   GEMINI_API_KEY=xxxx node refresh/run-one.mjs oil-india 2026-06-01

import { readFileSync } from 'node:fs';
import { scanStock, makeBudget } from './pipeline.mjs';
import { parsePrimerSections } from './sources.mjs';

const slug = process.argv[2];
const since = process.argv[3] || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
if (!slug) { console.error('usage: node refresh/run-one.mjs <slug> [sinceYYYY-MM-DD]'); process.exit(1); }

const primers = JSON.parse(readFileSync(new URL('../data/primers.json', import.meta.url))).companies || [];
const p = primers.find(c => (c.file && c.file.includes(`/${slug}.`)) || c.slug === slug);
if (!p) { console.error(`slug "${slug}" not found in data/primers.json`); process.exit(1); }

const primerHtml = readFileSync(new URL(`../primers/${slug}.html`, import.meta.url), 'utf8');
const sections = parsePrimerSections(primerHtml);

const stock = { name: p.name, nse: p.nse, bse: p.bse, slug, thesis: `${p.hook || ''} Key themes: ${(p.tags || []).join('; ')}.` };
const budget = makeBudget();
const delta = await scanStock(stock, since, sections, budget);

console.log(JSON.stringify(delta, null, 2));
console.error(`\nsections parsed: ${sections.length} · grounded calls used: ${budget.used} (free cap ~500/day)`);
