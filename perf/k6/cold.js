// Redirect latency under sparse traffic, where most requests may land on a
// cold function. redirect.js keeps the function warm at 50 requests/s, so it
// cannot see this; real traffic for a small shortener looks like this file.
// One HEAD every INTERVAL on a fresh connection, like a new visitor. Compare
// http_req_waiting (server time) here against redirect.js: the gap is the cold-start cost.
//   k6 run -e BASE=https://www.iksi.app -e SLUG=QdM2whH -e INTERVAL=10m -e DURATION=6h perf/k6/cold.js
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE || 'https://www.iksi.app';
const SLUG = __ENV.SLUG || 'QdM2whH';

export const options = {
	scenarios: {
		sparse: {
			executor: 'constant-arrival-rate',
			rate: 1,
			timeUnit: __ENV.INTERVAL || '10m',
			duration: __ENV.DURATION || '6h',
			preAllocatedVUs: 1,
			maxVUs: 2
		}
	},
	noConnectionReuse: true,
	thresholds: { http_req_failed: ['rate<0.01'] },
	summaryTrendStats: ['p(50)', 'p(90)', 'p(95)', 'max', 'count']
};

export default function () {
	const res = http.head(`${BASE}/${SLUG}`, { redirects: 0, responseCallback: http.expectedStatuses(301, 302) });
	check(res, { 'is redirect': (r) => r.status === 301 || r.status === 302 });
	// One line per sample, so a slow outlier can be matched to its time and to
	// where it was served: a Cloudflare colo (end of cf-ray) or a Vercel region.
	const ray = res.headers['Cf-Ray'] || '';
	const vercel = res.headers['X-Vercel-Id'] || '';
	const where = ray ? ray.split('-').pop() : vercel ? vercel.split('::')[0] : '-';
	// Everything a new visitor waits for: TCP and TLS on a fresh connection, then the answer.
	const total = (res.timings.connecting + res.timings.tls_handshaking + res.timings.duration).toFixed(0);
	console.log(
		`${new Date().toISOString()} status=${res.status} where=${where} server_ms=${res.timings.waiting.toFixed(0)} total_ms=${total}`
	);
}
