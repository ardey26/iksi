# Performance

Load tests for the redirect path, and the reports they produced. Every report names the commit it ran against so numbers can be compared across architecture changes.

- Script: `k6/redirect.js` (HEAD on an existing short link at a constant arrival rate; no clicks recorded, destination never contacted).
- Script: `k6/redirect-many.js` (same, but picks one slug per iteration from `-e SLUGS=a,b,c`, so the run mixes warm and cold edge cache).
- Script: `k6/cold.js` (one HEAD every `INTERVAL` on a fresh connection, for hours). The two scripts above keep the function warm, so they cannot see cold starts; this one measures what a sparse visitor actually gets.
- Run locally: `k6 run -e BASE=https://www.iksi.app -e SLUG=QdM2whH perf/k6/redirect.js`
- Run from a US machine: Actions → Perf → Run workflow.

## Edge Worker: shelved

The Cloudflare edge Worker (`apps/redirect`, `infra/cloudflare/`) is built but not live, on purpose. Most visitors are in the Philippines, and Converge connections to Cloudflare have been spotty. A redirect that sometimes fails is worse than one that always takes ~55 ms from `sin1`, so DNS stays on Vercel and `EDGE_ENABLED` stays off.

Revisit when one of these holds:
- a test from Converge lines shows Cloudflare reliable: deploy the Worker to a `workers.dev` host and run `k6/cold.js` and `k6/redirect.js` against it for a day, judged on error rate and p99, not p50;
- most traffic comes from outside Asia, where the round trip to `sin1` dominates.

## Reports

| Date | What changed | Report |
|---|---|---|
| 2026-10-31 | Baseline: Vercel function in `sin1`, before the edge Worker | [baseline-vercel](reports/2026-10-31-baseline-vercel.md) |
| shelved | Edge Worker answers redirects from KV (see above) | none |
