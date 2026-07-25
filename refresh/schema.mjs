// refresh/schema.mjs
// The delta the refresh consumes: in-place EDITS that re-true the primer (+ stat refreshes).
// Not a developments feed. validateDelta() never throws and drops anything malformed.

export const DELTA_SHAPE = {
  slug: 'string',
  name: 'string',
  asOf: 'YYYY-MM-DD',
  status: 'updates | current',      // "current" => the primer already reflects reality
  // surgical: replace the EXACT verbatim substring `find` (within section `id`) with `replace`.
  edits: [{ id: 'section id, e.g. p3', find: 'exact stale substring', replace: 'minimal corrected text' }],
  statUpdates: [{ k: 'stat key', v: 'new value' }],
  bigChange: 'boolean',             // true => the whole primer should be rebuilt, not patched
  rebuildReason: 'string',
};

export function validateDelta(d, stock, today) {
  const base = { slug: stock.slug, name: stock.name, asOf: today, status: 'current', edits: [], statUpdates: [], bigChange: false, rebuildReason: '' };
  if (!d || typeof d !== 'object') return base;
  const edits = (Array.isArray(d.edits) ? d.edits : [])
    .filter(e => e && typeof e.id === 'string' && e.id.trim() && typeof e.find === 'string' && e.find.trim() && typeof e.replace === 'string')
    .map(e => ({ id: e.id.trim(), find: e.find, replace: e.replace }));
  const statUpdates = (Array.isArray(d.statUpdates) ? d.statUpdates : [])
    .filter(s => s && typeof s.k === 'string' && s.k.trim() && (typeof s.v === 'string' || typeof s.v === 'number'))
    .map(s => ({ k: s.k.trim(), v: String(s.v) }));
  const changed = edits.length || statUpdates.length;
  return {
    ...base,
    status: changed ? 'updates' : 'current',
    edits, statUpdates,
    bigChange: !!d.bigChange && changed,
    rebuildReason: changed ? String(d.rebuildReason || '') : '',
  };
}
