# Phase 2 deploy: edge redirects and click pipeline

Turns the pass-through Worker into one that answers redirects from KV (origin fallback on a miss) and ships clicks through a queue to the origin. Budget: 15 minutes plus the verification waits.

## 1. Prerequisites

- The Cloudflare cutover runbook (`README.md` in this folder) is complete and the pass-through Worker is live.
- `infra/SETUP.md` is done, specifically:
  - Workers Paid (2.3)
  - KV namespace `iksi-links` (2.4)
  - Queues `iksi-clicks` and `iksi-clicks-dlq` (2.5)
  - Deploy token (2.8)
  - GitHub secrets, including `EDGE_SECRET` (5.2)
  - Vercel env var `EDGE_SECRET` (4.2)

## 2. Put the KV namespace ID in `wrangler.toml`

The one manual step. In `apps/redirect/wrangler.toml`, replace `REPLACE_WITH_KV_ID` with the ID from SETUP.md 2.4. The ID is not secret. Commit it.

```sh
grep -n "id = " apps/redirect/wrangler.toml   # no REPLACE_WITH_KV_ID left
```

## 3. Deploy

Merge to `main`. After CI passes, `.github/workflows/deploy.yml` runs in the right order: migrations, the Vercel production deploy, then the Worker (`EDGE_SECRET` uploaded as a Worker secret, `VERSION` set to the commit). The web endpoints (resolve, ingest, purge) are inert until the Worker calls them, so this order is safe.

Watch it under GitHub → Actions → Deploy.

Fallback, only if the workflow is unavailable (deploy the web app first, then):

```sh
pnpm --filter @iksi/redirect exec wrangler login
pnpm --filter @iksi/redirect exec wrangler deploy --var VERSION:$(git rev-parse HEAD)
pnpm --filter @iksi/redirect exec wrangler secret put EDGE_SECRET
```

## 4. Verify

```sh
curl -s https://www.iksi.app/_health
curl -sI https://www.iksi.app/QdM2whH | grep -iE "^HTTP|x-iksi-route|x-vercel-id|location"
```

- [ ] `_health` shows `ok: true`, a `colo`, and `version` equal to the deployed commit SHA.
- [ ] The slug request is `302` with `x-iksi-route: slug` and **no** `x-vercel-id`. (Run it twice; the first can be a cache miss that falls back to the origin.)
- [ ] Open a short link in a browser. A new `Click` row appears within 30 seconds.
- [ ] Shorten a URL through the homepage in production. Within a minute its Safe Browsing verdict is stored (dashboard links view). This proves background work survives the response on Vercel.
- [ ] Edit that link's destination in the dashboard. The new destination is served within about 60 seconds (KV's per-location read cache is 60 s).
- [ ] If any step fails, check the DLQ `iksi-clicks-dlq` and the Worker logs (Workers & Pages → iksi-redirect → Logs) before rolling back.

## 5. After-cutover load test

Once step 4 passes, produce the after-edge report per `perf/README.md`: run `perf/k6/redirect.js` and `perf/k6/redirect-many.js` from Singapore, and the Perf workflow from the US.

## 6. Rollback

```sh
pnpm --filter @iksi/redirect exec wrangler rollback
```

Rolls the Worker back to its previous deployed version (pick the Phase 0 version if more than one deploy has happened; `wrangler deployments list` shows them). Redirects then fall back to the origin route, which still records clicks itself. A later push to `main` redeploys the Worker, so revert the offending commit as well.
