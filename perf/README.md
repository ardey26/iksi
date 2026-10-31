# Performance

Load tests for the redirect path, and the reports they produced. Every report names the commit it ran against so numbers can be compared across architecture changes.

- Script: `k6/redirect.js` (HEAD on an existing short link at a constant arrival rate; no clicks recorded, destination never contacted).
- Run locally: `k6 run -e BASE=https://www.iksi.app -e SLUG=QdM2whH perf/k6/redirect.js`
- Run from a US machine: Actions → Perf → Run workflow.

## Reports

| Date | What changed | Report |
|---|---|---|
| 2026-10-31 | Baseline: Vercel function in `sin1`, before the edge Worker | [baseline-vercel](reports/2026-10-31-baseline-vercel.md) |
