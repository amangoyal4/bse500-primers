// refresh/sources.mjs
// Free, authoritative RETRIEVAL — the "truth spine" so the model reads facts instead of
// inventing them. No API keys. Every fetch is wrapped so it degrades gracefully to [].
//
//  - BSE corporate announcements: the company's own SEBI LODR Reg-30 material-event filings.
//  - Google News RSS: press context + figures around those filings.
//
// Node 18+ (global fetch). Runs in a GitHub Action or a Cloudflare Worker.

const yyyymmdd = iso => iso.replace(/-/g, '');

// Browser-like headers — BSE's public API 403s bare requests.
const BSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.bseindia.com/',
  'Origin': 'https://www.bseindia.com',
};

// Returns [{date, headline, category, detail, source}] for the window, or [] on any failure.
export async function fetchBseAnnouncements(bseCode, sinceISO, todayISO) {
  if (!bseCode) return [];
  const url = `https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w`
    + `?strCat=-1&strPrevDate=${yyyymmdd(sinceISO)}&strToDate=${yyyymmdd(todayISO)}`
    + `&strScrip=${bseCode}&strSearch=P&strType=C`;
  try {
    const res = await fetch(url, { headers: BSE_HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = data?.Table || [];
    return rows.map(r => ({
      date: (r.NEWS_DT || r.News_submission_dt || '').slice(0, 10),
      headline: (r.HEADLINE || r.NEWSSUB || '').trim(),
      category: (r.CATEGORYNAME || r.SUBCATNAME || '').trim(),
      detail: (r.NEWSSUB || r.MORE || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 600),
      source: r.ATTACHMENTNAME
        ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${r.ATTACHMENTNAME}`
        : `https://www.bseindia.com/stock-share-price/x/x/${bseCode}/corp-announcements/`,
    })).filter(a => a.headline);
  } catch { return []; }
}

// Parse a primer's numbered sections into [{id, html}] (inner HTML) so the pipeline can
// return targeted in-place edits. Matches <section class="part" id="pN"> ... </section>.
export function parsePrimerSections(primerHtml) {
  const out = [];
  const re = /<section[^>]*class="[^"]*\bpart\b[^"]*"[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/section>/gi;
  let m;
  while ((m = re.exec(primerHtml))) out.push({ id: m[1], html: m[2].trim() });
  return out;
}

// Returns [{date, headline, source, publisher}] from Google News RSS, or [] on failure.
export async function fetchGoogleNews(companyName, sinceISO) {
  if (!companyName) return [];
  const q = encodeURIComponent(`"${companyName}" (results OR acquisition OR order OR regulatory OR merger OR stake)`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
  const sinceMs = Date.parse(sinceISO + 'T00:00:00Z');
  try {
    const res = await fetch(url, { headers: { 'User-Agent': BSE_HEADERS['User-Agent'] } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split(/<item>/).slice(1);
    const out = [];
    for (const it of items) {
      const title = (it.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const link = (it.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '').trim();
      const pub = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
      const src = (it.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '').trim();
      const t = pub ? Date.parse(pub) : NaN;
      if (!title || (!isNaN(t) && !isNaN(sinceMs) && t < sinceMs)) continue;
      out.push({ date: isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10), headline: title, source: link, publisher: src });
    }
    return out.slice(0, 40);
  } catch { return []; }
}
