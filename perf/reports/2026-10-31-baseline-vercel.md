# Baseline: redirect latency before the edge cutover

Date: 2026-10-31 · Commit: `ab3b354` · Target: `https://www.iksi.app/QdM2whH` · Served by: Vercel function `sin1` (`x-vercel-id: sin1::sin1::hxfqn-1793461679867-51407f88c929`)

What it measures: iksi's own answer to a short link, end to end from the client. `HEAD` with no redirect following, so the destination is never contacted and the app records no click. Constant arrival rate of 50 requests/s for 2 minutes (6,000 requests per run).

| Run | Client region | p50 | p95 | p99 | max | Errors |
|---|---|---|---|---|---|---|
| 1 | Singapore (home connection) | 54.8 ms | 74.3 ms | 111.9 ms | 1.50 s | 0 / 6000 |
| 2 | Singapore (home connection) | 54.0 ms | 73.4 ms | 116.0 ms | 600 ms | 0 / 6000 |
| 3 | US (GitHub Actions runner) | pending | | | | |

Reading it: from Singapore, the function and the database are both local, so this is close to the best case for the current architecture. The p99 tail and the 0.6 to 1.5 s maxima are cold starts and per-instance cache misses in the serverless function. The US row is the number the edge Worker is expected to move the most: it pays a trans-Pacific round trip to `sin1` on every redirect.

Reproduce:

```sh
k6 run -e BASE=https://www.iksi.app -e SLUG=QdM2whH perf/k6/redirect.js
```

US run: Actions → Perf → Run workflow; the summary is attached as the `k6-summary-us` artifact.

Raw summaries: `raw-sgp-1.json`, `raw-sgp-2.json`.
