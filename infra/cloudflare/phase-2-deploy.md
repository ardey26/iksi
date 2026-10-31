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

The one manual step. On this branch, before it merges to `main`, replace `REPLACE_WITH_KV_ID` in `apps/redirect/wrangler.toml` with the ID from SETUP.md 2.4 and commit it. The ID is not secret. The merge triggers the Worker deploy; a deploy with the placeholder fails at the Worker step, after the web app has already deployed.

```sh
grep -n "id = " apps/redirect/wrangler.toml   # no REPLACE_WITH_KV_ID left
```

## 3. Deploy

Merge to `main`. After CI passes, `.github/workflows/deploy.yml` runs in the right order: migrations, the Vercel production deploy, then the Worker (`EDGE_SECRET` uploaded as a Worker secret, `VERSION` set to the commit). The web endpoints (resolve, ingest, purge) are inert until the Worker calls them, so this order is safe.

Watch it under GitHub → Actions → Deploy.

Fallback, only when the workflow itself is broken. Run the same steps in the same order (migrations, web app, Worker). `DATABASE_SESSION_URL` is described in SETUP.md section 3.

```sh
# 1. Migrations (session pooler, port 5432)
export DATABASE_URL='<DATABASE_SESSION_URL>' DIRECT_URL='<DATABASE_SESSION_URL>'
pnpm --filter @iksi/web exec prisma migrate deploy

# 2. Web app (needs VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID exported)
npx --yes vercel@65.9.0 pull --yes --environment=production --token="$VERCEL_TOKEN"
npx --yes vercel@65.9.0 build --prod --token="$VERCEL_TOKEN"
npx --yes vercel@65.9.0 deploy --prebuilt --prod --token="$VERCEL_TOKEN"

# 3. Worker
cd apps/redirect
npx -y pnpm@10.34.6 exec wrangler login
npx -y pnpm@10.34.6 exec wrangler secret put EDGE_SECRET
npx -y pnpm@10.34.6 exec wrangler deploy --var VERSION:$(git rev-parse HEAD)
```

## 4. Verify

```sh
curl -s https://www.iksi.app/_health
curl -sI https://www.iksi.app/QdM2whH | grep -iE "^HTTP|x-iksi-route|x-vercel-id|location"
```

- [ ] `_health` shows `ok: true`, a `colo`, and `version` equal to the deployed commit SHA.
- [ ] The slug request is `302` with `x-iksi-route: slug` and **no** `x-vercel-id`. On a KV miss the Worker resolves the link from the origin and still answers the redirect itself, so a failure on the first request is a real failure. Any failing check here blocks the rollout.
- [ ] Open a short link in a browser. A new `Click` row appears within 30 seconds.
- [ ] Shorten a URL through the homepage in production. Within a minute its Safe Browsing verdict is stored (dashboard links view). This proves background work survives the response on Vercel.
- [ ] Edit that link's destination in the dashboard. The new destination is served within about 60 seconds (KV's per-location read cache is 60 s).
- [ ] If any step fails, check the DLQ `iksi-clicks-dlq` and the Worker logs (Workers & Pages → iksi-redirect → Logs) before rolling back.

## 5. After-cutover load test

Once step 4 passes, produce the after-edge report per `perf/README.md`: run `perf/k6/redirect.js` and `perf/k6/redirect-many.js` from Singapore, and the Perf workflow from the US.

## 6. Rollback

Every push to `main` redeploys the Worker, so the previous version is not necessarily the Phase 0 one. List versions and pick the one to return to:

```sh
npx -y pnpm@10.34.6 --filter @iksi/redirect exec wrangler deployments list
npx -y pnpm@10.34.6 --filter @iksi/redirect exec wrangler rollback <version-id> -m "<reason>" -y
```

Redirects then fall back to the origin route, which still records clicks itself. Clicks already in `iksi-clicks` stay queued while no consumer runs and are delivered after redeploy (they expire after the queue's retention period). A later push to `main` redeploys the Worker, so revert the offending commit as well.
