import { browser } from '$app/environment';
import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit-next';

// Real visitors' Core Web Vitals, reported to Vercel Speed Insights (Vercel
// dashboard › Speed Insights). The script and its reports stay on this
// origin (/_vercel/speed-insights/*), so the CSP needs no change. It only
// reports once Speed Insights is enabled for the project on Vercel.
//
// `sveltekit-next`, not `sveltekit`: the plain entry reads `$app/stores`,
// which SvelteKit 3 removed, and that throws on load and stops every page
// from hydrating. Browser only, and not under `vite dev`, where it would
// fetch a debug script from a CDN the CSP blocks.
if (browser && !import.meta.env.DEV) injectSpeedInsights();
