import { classifyPath } from '@iksi/core';

/** Phase 2 adds KV, QUEUE and ANALYTICS bindings. */
export interface Env {
	VERSION?: string;
}

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
			origin = await upstream(request);
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

export const handleRequest: Handler = createHandler((request) => fetch(request));
