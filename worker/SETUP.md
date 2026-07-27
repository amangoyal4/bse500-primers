# Wiring the ⟳ Refresh button — one-time setup

The button is already coded into all 500 primers. It POSTs `{slug, symbol, password}` to a
Cloudflare Worker, which verifies the password and fires a GitHub Action that refreshes that
one company and commits. **No GitHub token or Gemini key ever reaches the browser.**

You do 3 things once; then tell Claude the Worker URL to flip the button live.

## 1. GitHub secret — the model key
Repo → Settings → Secrets and variables → Actions → **New repository secret**
- `GEMINI_API_KEY` = your (paid, dedicated) Gemini key.
  Use a **separate key/project** from Guardian Times, and set a **billing budget alert**.

## 2. GitHub token for the Worker
Create a **fine-grained PAT** (github.com → Settings → Developer settings → Fine-grained tokens):
- Repository access: **only** `amangoyal4/nse750-primers`
- Permissions: **Contents → Read and write** (this also allows repository_dispatch)
- Copy the token (starts `github_pat_…`). You'll paste it into the Worker in step 3 — never into any file.

## 3. Deploy the Worker
```bash
npm i -g wrangler
cd worker
wrangler login
wrangler deploy
wrangler secret put GH_TOKEN          # paste the fine-grained PAT
wrangler secret put REFRESH_PASSWORD  # choose the shared button password
```
`wrangler deploy` prints your Worker URL, e.g. `https://bse500-refresh.<you>.workers.dev`.

## 4. Flip it live
Send Claude that URL. It sets `REFRESH_ENDPOINT` in all 500 primers and pushes. Done —
clicking ⟳ then prompts for the password once and queues a refresh.

## Test it end to end
```bash
# does the pipeline run for one company with your key? (local)
GEMINI_API_KEY=xxxx node refresh/run-one.mjs reliance-industries
# does the Worker trigger the Action?
curl -X POST https://bse500-refresh.<you>.workers.dev \
  -H 'content-type: application/json' \
  -d '{"slug":"reliance-industries","password":"<yourpw>"}'
# → {"queued":true,...}; watch the "Refresh one primer" run in the repo's Actions tab.
```

## Notes
- **Async by design:** a click queues a run (~2–4 min: Action refreshes → commits → Pages redeploys).
- **Quiet is the feature:** most refreshes find no material change and commit nothing.
- **Safety:** the slug is strictly validated (Worker + workflow); edits are surgical exact-match
  with a no-invented-numbers guard; every change is a reversible git commit.
- To change the password later: `wrangler secret put REFRESH_PASSWORD` (no redeploy of primers needed).
