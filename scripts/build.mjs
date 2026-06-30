/*
 * build.mjs — BSE/Nifty 500 live data pipeline.
 *
 * Reads data/constituents.csv, fetches free Yahoo Finance data for every
 * constituent (no paid API), and writes:
 *   data/index.json         compact snapshot of all companies (drives the grid)
 *   data/co/<SYMBOL>.json    deep per-company file (drives the company page)
 *   data/meta.json          build timestamp + counts
 *
 * Free-feed strategy:
 *   - chart endpoint (no auth)  -> price, prev close, 52w, 1y history
 *   - quoteSummary (one crumb)  -> fundamentals, profile, earnings date
 * Tickers use the NSE symbol with a .NS suffix (Yahoo's convention).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'data');
const CO = join(DATA, 'co');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ---- CLI: optional --limit N to build a subset while developing -------------
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const CONCURRENCY = 6;       // polite parallelism
const PER_REQ_PAUSE = 120;   // ms between request starts

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => (v && typeof v === 'object' && 'raw' in v ? v.raw : typeof v === 'number' ? v : null);

// ---- constituent list -------------------------------------------------------
function parseCSV(text) {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const cols = header.split(',');
  const idx = (name) => cols.findIndex((c) => c.trim().toLowerCase() === name);
  const iName = idx('company name'), iInd = idx('industry'), iSym = idx('symbol'), iIsin = idx('isin code');
  return rows
    .map((line) => {
      // naive CSV split is fine: NSE list has no quoted commas
      const f = line.split(',');
      return { name: f[iName]?.trim(), sector: f[iInd]?.trim(), symbol: f[iSym]?.trim(), isin: f[iIsin]?.trim() };
    })
    .filter((c) => c.symbol);
}

// ---- crumb handshake (once per run) ----------------------------------------
async function getCrumb() {
  let cookie = '';
  for (const url of ['https://fc.yahoo.com/', 'https://finance.yahoo.com/']) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      const sc = r.headers.get('set-cookie');
      if (sc) { cookie = sc.split(',').map((s) => s.split(';')[0]).join('; '); if (cookie) break; }
    } catch { /* try next */ }
  }
  let crumb = '';
  try {
    const rc = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie } });
    crumb = (await rc.text()).trim();
  } catch { /* fall through */ }
  const valid = crumb && crumb.length < 40 && !crumb.includes('<');
  return { cookie, crumb: valid ? crumb : '' };
}

async function fetchJSON(url, headers, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers });
      if (r.status === 429) { await sleep(800 * (i + 1)); continue; }
      if (!r.ok) throw new Error('status ' + r.status);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(400 * (i + 1));
    }
  }
}

// ---- per-company fetch ------------------------------------------------------
async function fetchCompany(c, auth) {
  const sym = c.symbol + '.NS';
  const out = { ...c, ticker: sym, ok: false };

  // 1) chart (no auth): price + history
  try {
    const j = await fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1y&interval=1d`, { 'User-Agent': UA });
    const res = j.chart.result[0];
    const m = res.meta;
    out.price = m.regularMarketPrice ?? null;
    out.currency = m.currency || 'INR';
    // NOTE: with range=1y, m.chartPreviousClose is the close BEFORE the window
    // (a year ago) — useless for day change. Prefer m.previousClose; otherwise
    // the price module below overrides with the authoritative value.
    out.prevClose = m.previousClose ?? null;
    out.dayHigh = m.regularMarketDayHigh ?? null;
    out.dayLow = m.regularMarketDayLow ?? null;
    out.week52High = m.fiftyTwoWeekHigh ?? null;
    out.week52Low = m.fiftyTwoWeekLow ?? null;
    out.exchange = m.fullExchangeName || m.exchangeName || null;
    out.name = m.longName || out.name;
    // compact history: ~weekly samples to keep files small
    const ts = res.timestamp || [];
    const close = res.indicators?.quote?.[0]?.close || [];
    const hist = [];
    for (let i = 0; i < ts.length; i += 5) {
      if (close[i] != null) hist.push([ts[i], +close[i].toFixed(2)]);
    }
    out.history = hist;
    out.ok = out.price != null;
  } catch (e) {
    out.error = 'chart: ' + e.message;
  }

  // 2) quoteSummary (auth): fundamentals
  if (auth.crumb) {
    try {
      const modules = ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'summaryProfile', 'calendarEvents'].join(',');
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;
      const j = await fetchJSON(url, { 'User-Agent': UA, Cookie: auth.cookie });
      const r = j.quoteSummary?.result?.[0];
      if (r) {
        const sd = r.summaryDetail || {}, ks = r.defaultKeyStatistics || {}, fd = r.financialData || {}, sp = r.summaryProfile || {}, ce = r.calendarEvents || {};
        const pr = r.price || {};
        // authoritative live snapshot (overrides chart fallbacks)
        if (num(pr.regularMarketPrice) != null) out.price = num(pr.regularMarketPrice);
        if (num(pr.regularMarketPreviousClose) != null) out.prevClose = num(pr.regularMarketPreviousClose);
        if (num(pr.regularMarketChangePercent) != null) out.changePercent = num(pr.regularMarketChangePercent) * 100;
        out.marketCap = num(sd.marketCap) ?? num(r.price?.marketCap);
        out.pe = num(sd.trailingPE);
        out.forwardPE = num(sd.forwardPE);
        out.pb = num(ks.priceToBook);
        out.eps = num(ks.trailingEps);
        out.dividendYield = num(sd.dividendYield);
        out.beta = num(sd.beta) ?? num(ks.beta);
        out.sectorY = sp.sector || null;
        out.industryY = sp.industry || null;
        out.employees = sp.fullTimeEmployees ?? null;
        out.website = sp.website || null;
        out.summary = sp.longBusinessSummary || null;
        out.revenue = num(fd.totalRevenue);
        out.revenueGrowth = num(fd.revenueGrowth);
        out.grossMargin = num(fd.grossMargins);
        out.profitMargin = num(fd.profitMargins);
        out.operatingMargin = num(fd.operatingMargins);
        out.roe = num(fd.returnOnEquity);
        out.roa = num(fd.returnOnAssets);
        out.debtToEquity = num(fd.debtToEquity);
        out.currentRatio = num(fd.currentRatio);
        out.ebitda = num(fd.ebitda);
        out.freeCashflow = num(fd.freeCashflow);
        out.recommendation = fd.recommendationKey || null;
        out.targetMean = num(fd.targetMeanPrice);
        const ed = ce.earnings?.earningsDate?.[0];
        out.nextEarnings = ed ? (ed.fmt || null) : null;
      }
    } catch (e) {
      out.error = (out.error ? out.error + '; ' : '') + 'qs: ' + e.message;
    }
  }
  return out;
}

// ---- index (compact) subset of fields --------------------------------------
function toIndexRow(c) {
  const chgPct = c.changePercent != null
    ? c.changePercent
    : (c.price != null && c.prevClose ? ((c.price - c.prevClose) / c.prevClose) * 100 : null);
  return {
    name: c.name, symbol: c.symbol, ticker: c.ticker,
    sector: c.sectorY || c.sector,
    price: c.price, currency: c.currency, chgPct: chgPct != null ? +chgPct.toFixed(2) : null,
    marketCap: c.marketCap ?? null, pe: c.pe ?? null, pb: c.pb ?? null,
    week52High: c.week52High ?? null, week52Low: c.week52Low ?? null,
    revenueGrowth: c.revenueGrowth ?? null, roe: c.roe ?? null,
    nextEarnings: c.nextEarnings ?? null, ok: c.ok,
  };
}

// ---- main -------------------------------------------------------------------
async function main() {
  if (!existsSync(CO)) mkdirSync(CO, { recursive: true });
  const list = parseCSV(readFileSync(join(DATA, 'constituents.csv'), 'utf8')).slice(0, LIMIT);
  console.log(`Building ${list.length} companies (concurrency ${CONCURRENCY})`);

  const auth = await getCrumb();
  console.log('crumb:', auth.crumb ? 'OK' : 'MISSING (fundamentals will be skipped)');

  const index = [];
  let done = 0, okCount = 0;
  const queue = [...list];

  async function worker(id) {
    while (queue.length) {
      const c = queue.shift();
      await sleep(PER_REQ_PAUSE);
      try {
        const data = await fetchCompany(c, auth);
        data.updated = new Date().toISOString();
        writeFileSync(join(CO, c.symbol + '.json'), JSON.stringify(data));
        index.push(toIndexRow(data));
        if (data.ok) okCount++;
      } catch (e) {
        index.push(toIndexRow({ ...c, ticker: c.symbol + '.NS', ok: false }));
        console.warn('FAIL', c.symbol, e.message);
      }
      done++;
      if (done % 25 === 0 || done === list.length) console.log(`  ${done}/${list.length} (${okCount} ok)`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

  index.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  writeFileSync(join(DATA, 'index.json'), JSON.stringify(index));
  writeFileSync(join(DATA, 'meta.json'), JSON.stringify({
    updated: new Date().toISOString(),
    count: index.length,
    ok: okCount,
    universe: 'Nifty 500 (proxy for BSE 500)',
    source: 'Yahoo Finance (free)',
  }, null, 2));
  console.log(`Done. ${okCount}/${index.length} priced. Wrote index.json + ${index.length} company files.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
