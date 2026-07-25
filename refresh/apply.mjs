// refresh/apply.mjs — apply surgical find/replace edits to a primer HTML string.
// Each edit replaces the EXACT verbatim substring `find` (within its section) with `replace`.
// If `find` isn't found, the edit is SKIPPED — worst case is no change, never a bad rewrite.

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Extract "figures" (numbers that look like real data — has a comma, a decimal, or >=2 digits).
function figures(text) {
  const out = new Set();
  for (const t of String(text || '').match(/\d[\d,]*(?:\.\d+)?/g) || []) {
    const n = t.replace(/,/g, '');
    if (t.includes(',') || t.includes('.') || n.length >= 2) out.add(n);
  }
  return out;
}

// CODE-level safety so edits can auto-apply without human review. Drops any edit that:
//  - introduces a figure not in the original text AND not in the verified sources (blocks hallucinated numbers),
//  - is much longer than what it replaces (blocks padding/rewrites),
//  - whose find-text isn't actually in its section.
export function guardEdits(edits, sections, developments) {
  const known = figures(JSON.stringify(developments || []));
  const secById = Object.fromEntries((sections || []).map(s => [s.id, s.html]));
  const kept = [], dropped = [];
  for (const e of (edits || [])) {
    const sec = secById[e.id] || '';
    if (sec && !sec.includes(e.find)) { dropped.push(`${e.id}:find-not-in-section`); continue; }
    if (e.replace.length > e.find.length * 2.5 + 60) { dropped.push(`${e.id}:too-long`); continue; }
    const findNums = figures(e.find);
    let bad = '';
    for (const n of figures(e.replace)) { if (!findNums.has(n) && !known.has(n)) { bad = n; break; } }
    if (bad) { dropped.push(`${e.id}:unsourced-number(${bad})`); continue; }
    kept.push(e);
  }
  return { kept, dropped };
}

export function applyDelta(html, delta) {
  let out = html, applied = 0, notes = [];
  for (const e of (delta.edits || [])) {
    const secRe = new RegExp('(<section[^>]*\\bid="' + esc(e.id) + '"[^>]*>)([\\s\\S]*?)(<\\/section>)', 'i');
    if (!secRe.test(out)) { notes.push(`section "${e.id}" not found — skipped`); continue; }
    out = out.replace(secRe, (whole, open, inner, close) => {
      if (e.find && inner.includes(e.find)) { applied++; return open + inner.replace(e.find, e.replace) + close; }
      notes.push(`find-text not present in "${e.id}" — skipped (no change)`);
      return whole;
    });
  }
  for (const s of (delta.statUpdates || [])) {
    const re = new RegExp('(data-k="' + esc(s.k) + '"[\\s\\S]*?class="v"[^>]*>)([\\s\\S]*?)(<\\/)', 'i');
    if (re.test(out)) { out = out.replace(re, (_m, a, _b, c) => a + s.v + c); applied++; }
    else notes.push(`stat "${s.k}" has no data-k marker — skipped`);
  }
  return { html: out, applied, notes };
}
