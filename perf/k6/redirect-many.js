// Redirect latency across several slugs: a mix of warm and cold edge cache
// instead of one warm key. One slug is picked per iteration.
// HEAD + no redirect following: measures only iksi's answer, never the
// destination, and the app does not record clicks for HEAD requests.
//   k6 run -e BASE=https://www.iksi.app -e SLUGS=QdM2whH,abc,def perf/k6/redirect-many.js
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE || 'https://www.iksi.app';
const SLUGS = (__ENV.SLUGS || 'QdM2whH')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

export const options = {
	scenarios: {
		steady: {
			executor: 'constant-arrival-rate',
			rate: Number(__ENV.RATE || 50),
			timeUnit: '1s',
			duration: __ENV.DURATION || '2m',
			preAllocatedVUs: 20,
			maxVUs: 100
		}
	},
	thresholds: { http_req_failed: ['rate<0.01'] },
	summaryTrendStats: ['p(50)', 'p(95)', 'p(99)', 'max']
};

export default function () {
	const slug = SLUGS[Math.floor(Math.random() * SLUGS.length)];
	const res = http.head(`${BASE}/${slug}`, { redirects: 0, responseCallback: http.expectedStatuses(302) });
	check(res, { 'is 302': (r) => r.status === 302 });
}
