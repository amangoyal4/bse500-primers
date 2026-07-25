// Cloudflare Worker — refresh trigger for BSE-500 primers.
// The primer's ⟳ button POSTs {slug, symbol, password} here. The Worker verifies the
// shared password server-side, then fires a GitHub `repository_dispatch` event that runs
// the refresh-one workflow for that one company. No GitHub token or Gemini key ever
// touches the browser — both live only in this Worker / GitHub Actions secrets.
//
// Secrets (set with `wrangler secret put …`):  GH_TOKEN, REFRESH_PASSWORD
// Vars (in wrangler.toml):                      ALLOW_ORIGIN, GH_OWNER, GH_REPO

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "method-not-allowed" }, 405, cors);

    let body;
    try { body = await req.json(); } catch { return json({ error: "bad-json" }, 400, cors); }

    const slug = String(body.slug || "").trim();
    const password = String(body.password || "");

    // slug is interpolated into a workflow — validate strictly.
    if (!/^[a-z0-9-]{2,64}$/.test(slug)) return json({ error: "bad-slug" }, 400, cors);
    if (!env.REFRESH_PASSWORD || !timingSafeEqual(password, env.REFRESH_PASSWORD)) {
      return json({ error: "unauthorized" }, 401, cors);
    }

    const gh = await fetch(
      `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "bse500-refresh-worker",
        },
        body: JSON.stringify({ event_type: "refresh-one", client_payload: { slug } }),
      }
    );

    if (!gh.ok) {
      const detail = await gh.text().catch(() => "");
      return json({ error: "dispatch-failed", status: gh.status, detail: detail.slice(0, 200) }, 502, cors);
    }
    return json({ queued: true, slug }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// constant-time-ish string compare (avoids trivial length/prefix timing leaks)
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
