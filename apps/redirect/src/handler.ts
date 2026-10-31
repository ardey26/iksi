import { classifyPath } from '@iksi/core';

/** Phase 2 adds KV, QUEUE and ANALYTICS bindings. */
export interface Env {
	VERSION?: string;
	/** Shared with the app (EDGE_SECRET there) so it trusts the visitor headers below. */
	EDGE_SECRET?: string;
}

/** Must match EDGE_HEADERS in apps/web/src/lib/server/client.ts. */
const EDGE_SECRET_HEADER = 'x-iksi-edge';
const CLIENT_IP_HEADER = 'x-iksi-client-ip';
const CLIENT_COUNTRY_HEADER = 'x-iksi-client-country';

/** Sends a request on to the app origin. In production this is the global `fetch`. */
export type Upstream = (request: Request) => Promise<Response>;

export type Handler = (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;

/**
 * Phase 0 front door: forwards every request to origin unchanged and tags the
 * response with `x-iksi-route` so the routing split can be observed in
 * production before the Worker starts answering redirects itself.
 */
export function createHandler(upstream: Upstream): Handler {
	return async (request, env) => {
		const url = new URL(request.url);

		if (url.pathname === '/_health') {
			const colo = (request as Request & { cf?: { colo?: string } }).cf?.colo ?? 'local';
			return Response.json(
				{ ok: true, colo, version: env.VERSION ?? 'dev' },
				{ headers: { 'cache-control': 'no-store' } }
			);
		}

		const route = classifyPath(url.pathname).kind;

		let origin: Response;
		try {
			// On its own route, a same-URL fetch from a Worker goes to the zone's
			// origin, not back into the Worker.
			origin = await upstream(withVisitorIdentity(request, env));
		} catch {
			return new Response('origin unavailable', {
				status: 502,
				headers: { 'retry-after': '5', 'x-iksi-route': route }
			});
		}

		const tagged = new Response(origin.body, origin);
		tagged.headers.set('x-iksi-route', route);
		return tagged;
	};
}

/**
 * Behind Cloudflare, the origin sees Cloudflare's IP and location. Forward the
 * visitor's own, signed with the shared secret; strip any copies the client
 * sent so they cannot be spoofed.
 */
function withVisitorIdentity(request: Request, env: Env): Request {
	const headers = new Headers(request.headers);
	headers.delete(EDGE_SECRET_HEADER);
	headers.delete(CLIENT_IP_HEADER);
	headers.delete(CLIENT_COUNTRY_HEADER);

	if (env.EDGE_SECRET) {
		headers.set(EDGE_SECRET_HEADER, env.EDGE_SECRET);
		const ip = request.headers.get('cf-connecting-ip');
		if (ip) headers.set(CLIENT_IP_HEADER, ip);
		const country = (request as Request & { cf?: { country?: string } }).cf?.country;
		if (country) headers.set(CLIENT_COUNTRY_HEADER, country);
	}
	return new Request(request, { headers });
}

export const handleRequest: Handler = createHandler((request) => fetch(request));
