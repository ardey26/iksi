// Redirect latency at a steady arrival rate.
// HEAD + no redirect following: measures only iksi's answer, never the
// destination, and the app does not record clicks for HEAD requests.
//   k6 run -e BASE=https://www.iksi.app -e SLUG=QdM2whH perf/k6/redirect.js
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE || 'https://www.iksi.app';
const SLUG = __ENV.SLUG || 'QdM2whH';

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
	const res = http.head(`${BASE}/${SLUG}`, { redirects: 0, responseCallback: http.expectedStatuses(302) });
	check(res, { 'is 302': (r) => r.status === 302 });
}
