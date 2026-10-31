import {
	CANONICAL_HOST,
	classifyPath,
	surfaceFromQuery,
	type ClickEvent,
	type EventSink,
	type LinkStore
} from '@iksi/core';
import { kvLinkStore } from './store';
import { queueEventSink } from './sink';
import { refreshLink, resolveLink } from './resolve';
import { EDGE_SECRET_HEADER, INTERNAL_HEADER, secretMatches } from './auth';

export interface Env {
	VERSION?: string;
	ORIGIN_URL?: string;
	LINKS: KVNamespace;
	CLICKS: Queue<ClickEvent>;
	/** Shared with the app (EDGE_SECRET there) so it trusts the visitor headers below. */
	EDGE_SECRET?: string;
}

/** Must match EDGE_HEADERS in apps/web/src/lib/server/client.ts. */
const CLIENT_IP_HEADER = 'x-iksi-client-ip';
const CLIENT_COUNTRY_HEADER = 'x-iksi-client-country';

/** Sends a request on to the app origin. In production this is the global `fetch`. */
export type Upstream = (request: Request) => Promise<Response>;

export type Handler = (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;

export interface HandlerDeps {
	upstream: Upstream;
	store: (env: Env) => LinkStore;
	sink: (env: Env) => EventSink;
	now: () => number;
}

const DEFAULT_ORIGIN = 'https://www.iksi.app';

/** The app origin the Worker forwards to and delivers click events to. */
export const originOf = (env: Env): string => env.ORIGIN_URL ?? DEFAULT_ORIGIN;

const MAX_PURGE_SLUGS = 100;

/**
 * Front door. Answers health, purge and short-link redirects itself; everything
 * else goes to origin unchanged. Responses are tagged with `x-iksi-route` so the
 * routing split can be observed in production.
 */
export function createHandler(deps: HandlerDeps): Handler {
	const { upstream } = deps;

	const passThrough = async (
		request: Request,
		env: Env,
		route: string,
		internal = false
	): Promise<Response> => {
		let origin: Response;
		try {
			// On its own route, a same-URL fetch from a Worker goes to the zone's
			// origin, not back into the Worker.
			origin = await upstream(withVisitorIdentity(request, env, internal));
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

	return async (request, env, ctx) => {
		const url = new URL(request.url);

		if (url.pathname === '/_health') {
			const colo = (request as Request & { cf?: { colo?: string } }).cf?.colo ?? 'local';
			return Response.json(
				{ ok: true, colo, version: env.VERSION ?? 'dev' },
				{ headers: { 'cache-control': 'no-store' } }
			);
		}

		if (url.pathname === '/_edge/purge' && request.method === 'POST') {
			return purge(request, env, deps.store(env));
		}

		if (isInternalPath(url.pathname)) {
			// Only the Worker's own calls (re-entering through this route) carry the
			// internal secret; to everyone else these endpoints do not exist.
			if (!(await secretMatches(request.headers.get(INTERNAL_HEADER), env.EDGE_SECRET))) {
				return new Response('Not found', {
					status: 404,
					headers: { 'cache-control': 'no-store', 'x-iksi-route': 'reserved' }
				});
			}
			return passThrough(request, env, 'reserved', true);
		}

		const path = classifyPath(url.pathname);
		const isRead = request.method === 'GET' || request.method === 'HEAD';
		if (path.kind !== 'slug' || path.mode !== 'redirect' || !isRead) {
			return passThrough(request, env, path.kind);
		}

		const store = deps.store(env);
		const resolveDeps = {
			upstream,
			origin: originOf(env),
			secret: env.EDGE_SECRET,
			now: deps.now(),
			defer: (work: Promise<unknown>) => ctx.waitUntil(work)
		};
		const resolution = await resolveLink(CANONICAL_HOST, path.slug, store, resolveDeps);

		if (resolution.kind === 'unavailable') {
			return new Response('iksi is briefly unavailable. Try again in a few seconds.', {
				status: 503,
				headers: {
					'retry-after': '5',
					'content-type': 'text/plain; charset=utf-8',
					'x-iksi-route': 'slug'
				}
			});
		}
		if (resolution.kind === 'missing' || resolution.record.flagged) {
			return passThrough(request, env, 'slug');
		}

		const { record } = resolution;
		if (resolution.stale) {
			scheduleRefresh(
				path.slug,
				() => refreshLink(CANONICAL_HOST, path.slug, store, resolveDeps),
				ctx
			);
		}
		if (request.method === 'GET') {
			const cf = (request as Request & { cf?: { country?: string } }).cf;
			const event: ClickEvent = {
				v: 1,
				linkId: record.id,
				ts: deps.now(),
				country: cf?.country ?? null,
				userAgent: request.headers.get('user-agent'),
				referer: request.headers.get('referer'),
				...surfaceFromQuery(url.searchParams)
			};
			ctx.waitUntil(
				deps
					.sink(env)
					.emit(event)
					.catch((error) => console.error(`click emit failed for slug ${path.slug}`, error))
			);
		}

		return new Response(null, {
			status: record.permanent ? 301 : 302,
			headers: {
				location: record.destination,
				'cache-control': 'private, no-store',
				'x-iksi-route': 'slug'
			}
		});
	};
}

/** Slugs with a refresh already running in this isolate, so a hot stale link refreshes once. */
const refreshing = new Set<string>();

function scheduleRefresh(slug: string, run: () => Promise<void>, ctx: ExecutionContext): void {
	if (refreshing.has(slug)) return;
	refreshing.add(slug);
	ctx.waitUntil(
		run()
			.catch((error) => console.error(`refresh failed for slug ${slug}`, error))
			.finally(() => refreshing.delete(slug))
	);
}

/**
 * Matches /internal and below, generously: case and repeated slashes are
 * folded so an origin that normalizes either cannot be reached around the check.
 */
function isInternalPath(pathname: string): boolean {
	const p = pathname.replace(/\/{2,}/g, '/').toLowerCase();
	return p === '/internal' || p.startsWith('/internal/');
}

async function purge(request: Request, env: Env, store: LinkStore): Promise<Response> {
	if (!(await secretMatches(request.headers.get(EDGE_SECRET_HEADER), env.EDGE_SECRET))) {
		return new Response(null, { status: 401 });
	}
	const body = await request.json().catch(() => null);
	const slugs = (body as { slugs?: unknown } | null)?.slugs;
	if (
		!Array.isArray(slugs) ||
		slugs.length > MAX_PURGE_SLUGS ||
		!slugs.every((s): s is string => typeof s === 'string' && s.length > 0)
	) {
		return new Response(null, { status: 400 });
	}
	await Promise.all(slugs.map((slug) => store.delete(CANONICAL_HOST, slug)));
	return new Response(null, { status: 204 });
}

/**
 * Behind Cloudflare, the origin sees Cloudflare's IP and location. Forward the
 * visitor's own, signed with the shared secret; strip any copies the client
 * sent so they cannot be spoofed. The internal header is always stripped and is
 * set again only for an already-verified internal call.
 */
function withVisitorIdentity(request: Request, env: Env, internal: boolean): Request {
	const headers = new Headers(request.headers);
	headers.delete(EDGE_SECRET_HEADER);
	headers.delete(INTERNAL_HEADER);
	headers.delete(CLIENT_IP_HEADER);
	headers.delete(CLIENT_COUNTRY_HEADER);

	if (env.EDGE_SECRET) {
		if (internal) headers.set(INTERNAL_HEADER, env.EDGE_SECRET);
		headers.set(EDGE_SECRET_HEADER, env.EDGE_SECRET);
		const ip = request.headers.get('cf-connecting-ip');
		if (ip) headers.set(CLIENT_IP_HEADER, ip);
		const country = (request as Request & { cf?: { country?: string } }).cf?.country;
		if (country) headers.set(CLIENT_COUNTRY_HEADER, country);
	}
	return new Request(request, { headers });
}

export const handleRequest: Handler = createHandler({
	upstream: (request) => fetch(request),
	store: (env) => kvLinkStore(env.LINKS),
	sink: (env) => queueEventSink(env.CLICKS),
	now: () => Date.now()
});
