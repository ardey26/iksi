import { env } from 'cloudflare:workers';
import type { ClickEvent, EventSink, LinkLookup, LinkRecord, LinkStore } from '@iksi/core';
import { createHandler, type Env, type HandlerDeps, type Upstream } from './handler';

const record: LinkRecord = {
	v: 2,
	id: 7,
	destination: 'https://example.com/a?x=1',
	flagged: false,
	permanent: false
};
const NOW = 50_000_000;

/** The real test bindings, with optional overrides such as the edge secret. */
const testEnv = (overrides: Partial<Env> = {}): Env => ({
	...env,
	...overrides
});

function recordingCtx() {
	const pending: Promise<unknown>[] = [];
	const ctx = {
		waitUntil(p: Promise<unknown>) {
			pending.push(p);
		},
		passThroughOnException() {}
	} as unknown as ExecutionContext;
	return { ctx, settle: () => Promise.all(pending), pending };
}
const ctx = recordingCtx().ctx;

/** Records every request the Worker forwards and answers with a canned response. */
function recordingUpstream(respond: (req: Request) => Response | Promise<Response>) {
	const seen: Request[] = [];
	const upstream: Upstream = async (req) => {
		seen.push(req.clone());
		return respond(req);
	};
	return { upstream, seen };
}

function memoryStore(initial: Record<string, LinkLookup> = {}) {
	const entries = new Map<string, LinkLookup>(Object.entries(initial));
	const calls: string[] = [];
	const store: LinkStore = {
		async get(_h, slug) {
			calls.push(`get:${slug}`);
			return entries.get(slug) ?? { kind: 'unknown' };
		},
		async putFound(_h, slug, r, now) {
			calls.push(`putFound:${slug}`);
			entries.set(slug, {
				kind: 'found',
				stored: { record: r, storedAt: now }
			});
		},
		async putMissing(_h, slug) {
			calls.push(`putMissing:${slug}`);
			entries.set(slug, { kind: 'missing' });
		},
		async delete(_h, slug) {
			calls.push(`delete:${slug}`);
			entries.delete(slug);
		}
	};
	return { store, entries, calls };
}

function recordingSink() {
	const events: ClickEvent[] = [];
	const sink: EventSink = {
		async emit(e) {
			events.push(e);
		}
	};
	return { sink, events };
}

/** Slug paths consult the store first; a known-missing slug falls through to origin untouched. */
const missingStore = () =>
	memoryStore({ QdM2whH: { kind: 'missing' }, abc: { kind: 'missing' } }).store;

const fresh = (r: LinkRecord = record): LinkLookup => ({
	kind: 'found',
	stored: { record: r, storedAt: NOW - 1000 }
});

/** Builds a handler over fakes. Pass-through tests only care about `upstream`. */
function deps(
	upstream: Upstream,
	store: LinkStore = memoryStore().store,
	sink: EventSink = recordingSink().sink
): HandlerDeps {
	return {
		upstream,
		store: () => store,
		sink: () => sink,
		now: () => NOW,
		random: () => 0.5
	};
}

test('health is answered locally, origin is not called', async () => {
	const { upstream, seen } = recordingUpstream(() => new Response('origin'));
	const res = await createHandler(deps(upstream))(
		new Request('https://www.iksi.app/_health'),
		testEnv(),
		ctx
	);
	expect(res.status).toBe(200);
	expect(res.headers.get('cache-control')).toBe('no-store');
	expect(await res.json()).toMatchObject({ ok: true, version: 'dev' });
	expect(seen).toHaveLength(0);
});

describe('/_health?deep=1', () => {
	const deep = () => new Request('https://www.iksi.app/_health?deep=1');

	test('plain /_health reports no origin field and never calls origin', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response(null, { status: 204 }));
		const res = await createHandler(deps(upstream))(
			new Request('https://www.iksi.app/_health'),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(await res.json()).not.toHaveProperty('origin');
		expect(seen).toHaveLength(0);
	});

	test('pings the origin with the internal secret and reports ok on 204', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response(null, { status: 204 }));
		const res = await createHandler(deps(upstream))(
			deep(),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(await res.json()).toMatchObject({ ok: true, version: 'dev', origin: 'ok' });
		expect(seen).toHaveLength(1);
		expect(seen[0].url).toBe('https://www.iksi.app/internal/ping');
		expect(seen[0].headers.get('x-iksi-internal')).toBe('s3cret');
	});

	test.each([
		['401', 'unauthorized', () => new Response('unauthorized', { status: 401 })],
		['500', 'down', () => new Response('boom', { status: 500 })],
		['404 (origin without ping)', 'down', () => new Response('nf', { status: 404 })],
		[
			'a throw',
			'down',
			() => {
				throw new Error('down');
			}
		]
	])('origin %s reports %s', async (_name, expected, respond) => {
		const { upstream } = recordingUpstream(respond);
		const res = await createHandler(deps(upstream))(
			deep(),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ ok: true, origin: expected });
	});
});

test('slug passes through and is tagged', async () => {
	const { upstream, seen } = recordingUpstream(
		() =>
			new Response(null, {
				status: 302,
				headers: { location: 'https://example.com' }
			})
	);
	const res = await createHandler(deps(upstream, missingStore()))(
		new Request('https://www.iksi.app/QdM2whH'),
		testEnv(),
		ctx
	);
	expect(res.status).toBe(302);
	expect(res.headers.get('x-iksi-route')).toBe('slug');
	expect(res.headers.get('location')).toBe('https://example.com');
	expect(seen[0].url).toBe('https://www.iksi.app/QdM2whH');
});

test('POST with body and query passes through intact', async () => {
	const { upstream, seen } = recordingUpstream(() => new Response('ok'));
	const res = await createHandler(deps(upstream))(
		new Request('https://www.iksi.app/api/shorten?x=1', {
			method: 'POST',
			body: '{"longURL":"https://a.b"}',
			headers: { 'content-type': 'application/json' }
		}),
		testEnv(),
		ctx
	);
	expect(res.status).toBe(200);
	expect(res.headers.get('x-iksi-route')).toBe('reserved');
	expect(seen[0].method).toBe('POST');
	expect(seen[0].url).toBe('https://www.iksi.app/api/shorten?x=1');
	expect(seen[0].headers.get('content-type')).toBe('application/json');
	expect(await seen[0].text()).toBe('{"longURL":"https://a.b"}');
});

test('HEAD passes through', async () => {
	const { upstream, seen } = recordingUpstream(() => new Response(null, { status: 302 }));
	const res = await createHandler(deps(upstream, missingStore()))(
		new Request('https://www.iksi.app/QdM2whH', { method: 'HEAD' }),
		testEnv(),
		ctx
	);
	expect(res.status).toBe(302);
	expect(seen[0].method).toBe('HEAD');
});

test('origin failure yields 502, not an exception', async () => {
	const { upstream } = recordingUpstream(() => {
		throw new Error('ECONNRESET');
	});
	const res = await createHandler(deps(upstream, missingStore()))(
		new Request('https://www.iksi.app/abc'),
		testEnv(),
		ctx
	);
	expect(res.status).toBe(502);
	expect(res.headers.get('retry-after')).toBe('5');
	expect(res.headers.get('x-iksi-route')).toBe('slug');
});

test('root is tagged root', async () => {
	const { upstream } = recordingUpstream(() => new Response('<html>'));
	const res = await createHandler(deps(upstream))(
		new Request('https://www.iksi.app/'),
		testEnv(),
		ctx
	);
	expect(res.headers.get('x-iksi-route')).toBe('root');
	expect(await res.text()).toBe('<html>');
});

test('unknown paths still reach origin and are tagged unknown', async () => {
	const { upstream, seen } = recordingUpstream(() => new Response('nf', { status: 404 }));
	const res = await createHandler(deps(upstream))(
		new Request('https://www.iksi.app/abc/def'),
		testEnv(),
		ctx
	);
	expect(res.status).toBe(404);
	expect(res.headers.get('x-iksi-route')).toBe('unknown');
	expect(seen).toHaveLength(1);
});

describe('visitor identity forwarded to origin', () => {
	const visitor = () =>
		new Request('https://www.iksi.app/QdM2whH', {
			headers: { 'cf-connecting-ip': '198.51.100.7' },
			cf: { country: 'SG' }
		} as RequestInit);

	test('sends visitor ip, country and the edge secret', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response(null, { status: 302 }));
		await createHandler(deps(upstream, missingStore()))(
			visitor(),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(seen[0].headers.get('x-iksi-edge')).toBe('s3cret');
		expect(seen[0].headers.get('x-iksi-client-ip')).toBe('198.51.100.7');
		expect(seen[0].headers.get('x-iksi-client-country')).toBe('SG');
	});

	test('drops client-supplied x-iksi headers so they cannot be spoofed', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('ok'));
		const spoofed = new Request('https://www.iksi.app/api/shorten', {
			method: 'POST',
			body: 'x',
			headers: {
				'x-iksi-edge': 'guess',
				'x-iksi-internal': 'guess',
				'x-iksi-client-ip': '6.6.6.6',
				'x-iksi-client-country': 'KP'
			}
		});
		await createHandler(deps(upstream))(spoofed, testEnv(), ctx);
		expect(seen[0].headers.get('x-iksi-edge')).toBeNull();
		expect(seen[0].headers.get('x-iksi-internal')).toBeNull();
		expect(seen[0].headers.get('x-iksi-client-ip')).toBeNull();
		expect(seen[0].headers.get('x-iksi-client-country')).toBeNull();
		expect(await seen[0].text()).toBe('x');
	});
});

describe('malformed paths', () => {
	test('a malformed escape gets the Worker 404 and is never forwarded', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('origin'));
		const res = await createHandler(deps(upstream))(
			new Request('https://www.iksi.app/abc%ZZ'),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(res.status).toBe(404);
		expect(seen).toHaveLength(0);
	});
});

describe('internal endpoints', () => {
	const internal = (path: string, method: string, headers: Record<string, string> = {}) =>
		new Request(`https://www.iksi.app${path}`, {
			method,
			headers,
			body: method === 'POST' ? '{"events":[]}' : undefined
		});
	const paths = ['/internal/resolve?slug=QdM2whH', '/internal/ingest', '/internal/ping'];
	const spoofs: [string, Record<string, string>][] = [
		['no header', {}],
		['a spoofed x-iksi-edge', { 'x-iksi-edge': 'guess' }],
		['a spoofed x-iksi-internal', { 'x-iksi-internal': 'guess' }],
		['the real secret in x-iksi-edge', { 'x-iksi-edge': 's3cret' }]
	];

	describe.each(paths)('%s', (path) => {
		test.each(['GET', 'POST'])('%s from a visitor is 404 and never forwarded', async (method) => {
			for (const [, headers] of spoofs) {
				const { upstream, seen } = recordingUpstream(() => new Response('secret data'));
				const res = await createHandler(deps(upstream))(
					internal(path, method, headers),
					testEnv({ EDGE_SECRET: 's3cret' }),
					ctx
				);
				expect(res.status).toBe(404);
				expect(seen).toHaveLength(0);
			}
		});
	});

	test.each([
		'/Internal/ingest',
		'//internal/ingest',
		'/internal/',
		'/%69nternal/ping',
		'/inte%72nal/ping',
		'/%49nternal/ping',
		'/%E0%A4%A/ping'
	])('%s is refused too', async (path) => {
		const { upstream, seen } = recordingUpstream(() => new Response('x'));
		const res = await createHandler(deps(upstream))(
			internal(path, 'POST'),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(res.status).toBe(404);
		expect(seen).toHaveLength(0);
	});

	test('no EDGE_SECRET configured refuses even an empty x-iksi-internal', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('x'));
		const res = await createHandler(deps(upstream))(
			internal('/internal/ingest', 'POST', { 'x-iksi-internal': '' }),
			testEnv(),
			ctx
		);
		expect(res.status).toBe(404);
		expect(seen).toHaveLength(0);
	});

	test('a request carrying the matching x-iksi-internal is forwarded with it', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('{}', { status: 200 }));
		const res = await createHandler(deps(upstream))(
			internal('/internal/ingest', 'POST', { 'x-iksi-internal': 's3cret' }),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(res.status).toBe(200);
		expect(seen).toHaveLength(1);
		expect(seen[0].url).toBe('https://www.iksi.app/internal/ingest');
		expect(seen[0].headers.get('x-iksi-internal')).toBe('s3cret');
		expect(await seen[0].text()).toBe('{"events":[]}');
	});
});

describe('edge redirect', () => {
	const get = (path: string, init: RequestInit & { cf?: unknown } = {}) =>
		new Request(`https://www.iksi.app${path}`, init as RequestInit);

	test('fresh record redirects from the edge and emits one click', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('origin'));
		const { store } = memoryStore({ QdM2whH: fresh() });
		const { sink, events } = recordingSink();
		const c = recordingCtx();
		const res = await createHandler(deps(upstream, store, sink))(
			get('/QdM2whH?s=profile&p=4&r=5', {
				headers: { 'user-agent': 'UA/1', referer: 'https://ref.example/' },
				cf: { country: 'SG' }
			}),
			testEnv(),
			c.ctx
		);
		await c.settle();
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe(record.destination);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(res.headers.get('x-iksi-route')).toBe('slug');
		expect(seen).toHaveLength(0);
		expect(events).toEqual([
			{
				v: 1,
				linkId: 7,
				ts: NOW,
				country: 'SG',
				userAgent: 'UA/1',
				referer: 'https://ref.example/',
				surface: 'profile',
				profileId: 4,
				rowId: 5
			}
		]);
	});

	test('the click is not awaited on the response path', async () => {
		const { upstream } = recordingUpstream(() => new Response('origin'));
		const { store } = memoryStore({ QdM2whH: fresh() });
		const sink: EventSink = { emit: () => new Promise(() => {}) };
		const c = recordingCtx();
		const res = await createHandler(deps(upstream, store, sink))(get('/QdM2whH'), testEnv(), c.ctx);
		expect(res.status).toBe(302);
		expect(c.pending).toHaveLength(1);
	});

	test('a failing sink does not fail the redirect', async () => {
		const { upstream } = recordingUpstream(() => new Response('origin'));
		const { store } = memoryStore({ QdM2whH: fresh() });
		const sink: EventSink = {
			emit: () => Promise.reject(new Error('queue down'))
		};
		const c = recordingCtx();
		const res = await createHandler(deps(upstream, store, sink))(get('/QdM2whH'), testEnv(), c.ctx);
		expect(res.status).toBe(302);
		await expect(c.settle()).resolves.toBeDefined();
	});

	test('HEAD redirects but emits nothing', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('origin'));
		const { store } = memoryStore({ QdM2whH: fresh() });
		const { sink, events } = recordingSink();
		const c = recordingCtx();
		const res = await createHandler(deps(upstream, store, sink))(
			get('/QdM2whH', { method: 'HEAD' }),
			testEnv(),
			c.ctx
		);
		await c.settle();
		expect(res.status).toBe(302);
		expect(events).toHaveLength(0);
		expect(seen).toHaveLength(0);
	});

	test('permanent links use 301', async () => {
		const { upstream } = recordingUpstream(() => new Response('origin'));
		const { store } = memoryStore({
			QdM2whH: fresh({ ...record, permanent: true })
		});
		const res = await createHandler(deps(upstream, store))(get('/QdM2whH'), testEnv(), ctx);
		expect(res.status).toBe(301);
	});

	test('flagged links pass through to origin', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('interstitial'));
		const { store } = memoryStore({
			QdM2whH: fresh({ ...record, flagged: true })
		});
		const { sink, events } = recordingSink();
		const c = recordingCtx();
		const res = await createHandler(deps(upstream, store, sink))(get('/QdM2whH'), testEnv(), c.ctx);
		await c.settle();
		expect(await res.text()).toBe('interstitial');
		expect(seen).toHaveLength(1);
		expect(events).toHaveLength(0);
	});

	test('missing links pass through to origin', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('nf', { status: 404 }));
		const { store } = memoryStore({ QdM2whH: { kind: 'missing' } });
		const res = await createHandler(deps(upstream, store))(get('/QdM2whH'), testEnv(), ctx);
		expect(res.status).toBe(404);
		expect(res.headers.get('x-iksi-route')).toBe('slug');
		expect(seen).toHaveLength(1);
	});

	test('unknown link with origin down is a 503', async () => {
		const { upstream } = recordingUpstream(() => {
			throw new Error('down');
		});
		const res = await createHandler(deps(upstream))(get('/QdM2whH'), testEnv(), ctx);
		expect(res.status).toBe(503);
		expect(res.headers.get('retry-after')).toBe('5');
		expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
		expect(await res.text()).toBe('iksi is briefly unavailable. Try again in a few seconds.');
	});

	describe('origin resolve unavailable falls back to the origin route', () => {
		/** Answers /internal/resolve with `resolve`, the slug route with `route`. */
		const split = (resolve: () => Response, route: () => Response) =>
			recordingUpstream((req) =>
				new URL(req.url).pathname === '/internal/resolve' ? resolve() : route()
			);
		const originRedirect = () =>
			new Response(null, { status: 302, headers: { location: 'https://example.com/origin' } });

		test.each([
			['a secret mismatch (401)', () => new Response('unauthorized', { status: 401 })],
			['a 500', () => new Response('boom', { status: 500 })],
			[
				'an invalid record',
				() =>
					Response.json({
						found: true,
						record: { ...record, destination: 'javascript:alert(1)' }
					})
			]
		])('%s still redirects via the origin route', async (_name, resolve) => {
			const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
			const { upstream, seen } = split(resolve, originRedirect);
			const { sink, events } = recordingSink();
			const c = recordingCtx();
			const res = await createHandler(deps(upstream, memoryStore().store, sink))(
				get('/QdM2whH', { cf: { country: 'SG' } }),
				testEnv({ EDGE_SECRET: 's3cret' }),
				c.ctx
			);
			await c.settle();
			expect(res.status).toBe(302);
			expect(res.headers.get('location')).toBe('https://example.com/origin');
			expect(res.headers.get('x-iksi-route')).toBe('slug');
			expect(seen.map((r) => new URL(r.url).pathname)).toEqual(['/internal/resolve', '/QdM2whH']);
			// The origin route records the click itself; the edge must not double count.
			expect(events).toHaveLength(0);
			quiet.mockRestore();
		});

		test('a 404 from the origin route is returned as is', async () => {
			const { upstream } = split(
				() => new Response('x', { status: 500 }),
				() => new Response('branded 404', { status: 404 })
			);
			const res = await createHandler(deps(upstream))(get('/QdM2whH'), testEnv(), ctx);
			expect(res.status).toBe(404);
			expect(await res.text()).toBe('branded 404');
		});

		test('a 5xx from the origin route too is the 503', async () => {
			const { upstream } = split(
				() => new Response('x', { status: 500 }),
				() => new Response('bad gateway', { status: 502 })
			);
			const res = await createHandler(deps(upstream))(get('/QdM2whH'), testEnv(), ctx);
			expect(res.status).toBe(503);
			expect(res.headers.get('retry-after')).toBe('5');
			expect(res.headers.get('x-iksi-route')).toBe('slug');
			expect(await res.text()).toBe('iksi is briefly unavailable. Try again in a few seconds.');
		});
	});

	test('stale record still redirects and schedules a refresh', async () => {
		const { upstream, seen } = recordingUpstream(() =>
			Response.json({
				found: true,
				record: { ...record, destination: 'https://example.com/new' }
			})
		);
		const { store, entries } = memoryStore({
			QdM2whH: { kind: 'found', stored: { record, storedAt: NOW - 3_600_001 } }
		});
		const c = recordingCtx();
		const res = await createHandler(deps(upstream, store))(
			get('/QdM2whH'),
			testEnv({ EDGE_SECRET: 's3cret' }),
			c.ctx
		);
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe(record.destination);
		// click + refresh both scheduled
		expect(c.pending.length).toBeGreaterThanOrEqual(2);
		await c.settle();
		expect(seen[0].url).toBe('https://www.iksi.app/internal/resolve?slug=QdM2whH');
		expect(entries.get('QdM2whH')).toMatchObject({
			stored: {
				record: { destination: 'https://example.com/new' },
				storedAt: NOW
			}
		});
	});

	test.each(['/QdM2whH+', '/QdM2whH+stats'])('%s passes through, store untouched', async (path) => {
		const { upstream, seen } = recordingUpstream(() => new Response('page'));
		const { store, calls } = memoryStore({ QdM2whH: fresh() });
		const res = await createHandler(deps(upstream, store))(get(path), testEnv(), ctx);
		expect(await res.text()).toBe('page');
		expect(seen).toHaveLength(1);
		expect(calls).toEqual([]);
	});

	test('POST to a slug path is not redirected', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('x', { status: 405 }));
		const { store, calls } = memoryStore({ QdM2whH: fresh() });
		await createHandler(deps(upstream, store))(
			get('/QdM2whH', { method: 'POST', body: 'x' }),
			testEnv(),
			ctx
		);
		expect(seen).toHaveLength(1);
		expect(calls).toEqual([]);
	});
});

describe('resilience', () => {
	const get = (path: string) => new Request(`https://www.iksi.app${path}`);
	const quietly = () => vi.spyOn(console, 'error').mockImplementation(() => {});

	test('a KV that throws on get and put still redirects via origin', async () => {
		const log = quietly();
		const { upstream } = recordingUpstream(() => Response.json({ found: true, record }));
		const boom = async () => {
			throw new Error('kv 429');
		};
		const store: LinkStore = { get: boom, putFound: boom, putMissing: boom, delete: boom };
		const c = recordingCtx();
		const res = await createHandler(deps(upstream, store))(get('/QdM2whH'), testEnv(), c.ctx);
		expect(res.status).toBe(302);
		await expect(c.settle()).resolves.toBeDefined();
		log.mockRestore();
	});

	test('a failing putMissing still passes the miss through to origin', async () => {
		const log = quietly();
		const seen: string[] = [];
		const upstream: Upstream = async (req) => {
			seen.push(new URL(req.url).pathname);
			return new URL(req.url).pathname === '/internal/resolve'
				? new Response('{}', { status: 404 })
				: new Response('branded 404', { status: 404 });
		};
		const m = memoryStore();
		const store: LinkStore = {
			...m.store,
			putMissing: async () => {
				throw new Error('kv 429');
			}
		};
		const c = recordingCtx();
		const res = await createHandler(deps(upstream, store))(get('/Nope123'), testEnv(), c.ctx);
		expect(await res.text()).toBe('branded 404');
		await expect(c.settle()).resolves.toBeDefined();
		log.mockRestore();
	});

	test('two concurrent stale hits schedule exactly one origin refresh', async () => {
		let calls = 0;
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		const upstream: Upstream = async () => {
			calls++;
			await gate;
			return Response.json({ found: true, record });
		};
		const { store } = memoryStore({
			Stale01: { kind: 'found', stored: { record, storedAt: NOW - 3_600_001 } }
		});
		const h = createHandler(deps(upstream, store));
		const c = recordingCtx();
		await h(get('/Stale01'), testEnv(), c.ctx);
		await h(get('/Stale01'), testEnv(), c.ctx);
		release();
		await c.settle();
		expect(calls).toBe(1);
	});

	test('a failing click emit is logged with the slug', async () => {
		const log = quietly();
		const { upstream } = recordingUpstream(() => new Response('x'));
		const { store } = memoryStore({ QdM2whH: fresh() });
		const sink: EventSink = { emit: () => Promise.reject(new Error('queue down')) };
		const c = recordingCtx();
		await createHandler(deps(upstream, store, sink))(get('/QdM2whH'), testEnv(), c.ctx);
		await c.settle();
		expect(log).toHaveBeenCalledWith(expect.stringContaining('QdM2whH'), expect.anything());
		log.mockRestore();
	});
});

describe('POST /_edge/purge', () => {
	const purge = (secret: string | null, body: unknown, method = 'POST') =>
		new Request('https://www.iksi.app/_edge/purge', {
			method,
			headers: {
				...(secret ? { 'x-iksi-edge': secret } : {}),
				'content-type': 'application/json'
			},
			body: typeof body === 'string' ? body : JSON.stringify(body)
		});
	const seeded = () => memoryStore({ one: fresh(), two: fresh(), keep: fresh() });

	test('with the secret deletes every slug and answers 204', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('x'));
		const m = seeded();
		const res = await createHandler(deps(upstream, m.store))(
			purge('s3cret', { slugs: ['one', 'two'] }),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(res.status).toBe(204);
		expect([...m.entries.keys()]).toEqual(['keep']);
		expect(seen).toHaveLength(0);
	});

	test.each([
		['wrong', 'nope'],
		['missing', null]
	])('%s secret is 401 and store untouched', async (_n, secret) => {
		const { upstream } = recordingUpstream(() => new Response('x'));
		const m = seeded();
		const res = await createHandler(deps(upstream, m.store))(
			purge(secret, { slugs: ['one'] }),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(res.status).toBe(401);
		expect(m.calls).toEqual([]);
	});

	test('no EDGE_SECRET configured is 401 even for an empty header', async () => {
		const { upstream } = recordingUpstream(() => new Response('x'));
		const m = seeded();
		const res = await createHandler(deps(upstream, m.store))(
			purge('', { slugs: ['one'] }),
			testEnv(),
			ctx
		);
		expect(res.status).toBe(401);
		expect(m.calls).toEqual([]);
	});

	test.each([
		['not json', 'nope'],
		['no slugs', {}],
		['non-string slug', { slugs: [1] }],
		['too many', { slugs: Array.from({ length: 101 }, (_, i) => `s${i}`) }]
	])('bad body (%s) is 400', async (_n, body) => {
		const { upstream } = recordingUpstream(() => new Response('x'));
		const m = seeded();
		const res = await createHandler(deps(upstream, m.store))(
			purge('s3cret', body),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(res.status).toBe(400);
		expect(m.calls).toEqual([]);
	});

	test('100 slugs is accepted', async () => {
		const { upstream } = recordingUpstream(() => new Response('x'));
		const res = await createHandler(deps(upstream))(
			purge('s3cret', {
				slugs: Array.from({ length: 100 }, (_, i) => `s${i}`)
			}),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(res.status).toBe(204);
	});

	test('GET /_edge/purge is not the purge endpoint and passes through', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('x'));
		await createHandler(deps(upstream))(
			new Request('https://www.iksi.app/_edge/purge'),
			testEnv({ EDGE_SECRET: 's3cret' }),
			ctx
		);
		expect(seen).toHaveLength(1);
	});
});

describe('routing and decisions at the edge', () => {
	const get = (path: string, init: RequestInit & { cf?: unknown } = {}) =>
		new Request(`https://www.iksi.app${path}`, init as RequestInit);
	const IPHONE =
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
	const DESKTOP =
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
	const run = async (r: LinkRecord, req: Request, random = () => 0.5) => {
		const { upstream, seen } = recordingUpstream(() => new Response('origin'));
		const { store } = memoryStore({ QdM2whH: fresh(r) });
		const { sink, events } = recordingSink();
		const c = recordingCtx();
		const res = await createHandler({ ...deps(upstream, store, sink), random })(
			req,
			testEnv(),
			c.ctx
		);
		await c.settle();
		return { res, seen, events };
	};
	const mobileRule: LinkRecord = {
		...record,
		rules: [
			{
				id: 'rule0001',
				when: { devices: ['mobile'] },
				destination: 'https://m.example.com/'
			}
		]
	};

	test('a device rule sends an iPhone to its destination', async () => {
		const { res, events } = await run(
			mobileRule,
			get('/QdM2whH', { headers: { 'user-agent': IPHONE } })
		);
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('https://m.example.com/');
		expect(events).toHaveLength(1);
	});

	test('a desktop UA falls to the default destination', async () => {
		const { res } = await run(mobileRule, get('/QdM2whH', { headers: { 'user-agent': DESKTOP } }));
		expect(res.headers.get('location')).toBe('https://example.com/a?x=1');
	});

	test('a continent rule matches cf.country', async () => {
		const r: LinkRecord = {
			...record,
			rules: [
				{
					id: 'rule0002',
					when: { continents: ['EU'] },
					destination: 'https://eu.example.com/'
				}
			]
		};
		const { res } = await run(r, get('/QdM2whH', { cf: { country: 'DE' } }));
		expect(res.headers.get('location')).toBe('https://eu.example.com/');
	});

	test('a 50/50 split follows random', async () => {
		const r: LinkRecord = {
			...record,
			rules: [
				{
					id: 'rule0003',
					when: {},
					split: [
						{ destination: 'https://a.example.com/', weight: 50 },
						{ destination: 'https://b.example.com/', weight: 50 }
					]
				}
			]
		};
		const first = await run(r, get('/QdM2whH'), () => 0.2);
		const second = await run(r, get('/QdM2whH'), () => 0.7);
		expect(first.res.headers.get('location')).toBe('https://a.example.com/');
		expect(second.res.headers.get('location')).toBe('https://b.example.com/');
	});

	test.each([
		['protected', { ...record, protected: true }],
		['expired by time', { ...record, expiresAt: NOW - 1 }],
		['expired flag', { ...record, expired: true }]
	] as [string, LinkRecord][])('%s passes through with no click', async (_n, r) => {
		const { res, seen, events } = await run(r, get('/QdM2whH'));
		expect(await res.text()).toBe('origin');
		expect(seen).toHaveLength(1);
		expect(events).toHaveLength(0);
	});

	test('no UA, referer or cf resolves to the default, 302', async () => {
		const { res } = await run(mobileRule, get('/QdM2whH'));
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('https://example.com/a?x=1');
	});

	test('an unusable destination passes through with no click', async () => {
		const bad: LinkRecord = {
			...record,
			rules: [{ id: 'rule0009', when: {}, destination: 'not a url' }]
		};
		const { res, seen, events } = await run(bad, get('/QdM2whH'));
		expect(await res.text()).toBe('origin');
		expect(seen).toHaveLength(1);
		expect(events).toHaveLength(0);
	});

	test('a stale protected record passes through and schedules one refresh', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('origin'));
		const stale: LinkLookup = {
			kind: 'found',
			stored: { record: { ...record, protected: true }, storedAt: NOW - 24 * 3600 * 1000 }
		};
		const { store } = memoryStore({ QdM2whH: stale });
		const { sink, events } = recordingSink();
		const c = recordingCtx();
		const res = await createHandler(deps(upstream, store, sink))(get('/QdM2whH'), testEnv(), c.ctx);
		expect(await res.text()).toBe('origin');
		expect(c.pending).toHaveLength(1);
		await c.settle();
		expect(events).toHaveLength(0);
		expect(seen.map((r) => new URL(r.url).pathname)).toContain('/internal/resolve');
	});

	test('a permanent link redirects with 301', async () => {
		const { res } = await run(
			{ ...mobileRule, permanent: true },
			get('/QdM2whH', { headers: { 'user-agent': IPHONE } })
		);
		expect(res.status).toBe(301);
	});
});
