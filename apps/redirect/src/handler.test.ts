import { env } from 'cloudflare:workers';
import type { ClickEvent, EventSink, LinkLookup, LinkRecord, LinkStore } from '@iksi/core';
import { createHandler, type Env, type HandlerDeps, type Upstream } from './handler';

const record: LinkRecord = {
	v: 1,
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
	return { upstream, store: () => store, sink: () => sink, now: () => NOW };
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
				'x-iksi-client-ip': '6.6.6.6',
				'x-iksi-client-country': 'KP'
			}
		});
		await createHandler(deps(upstream))(spoofed, testEnv(), ctx);
		expect(seen[0].headers.get('x-iksi-edge')).toBeNull();
		expect(seen[0].headers.get('x-iksi-client-ip')).toBeNull();
		expect(seen[0].headers.get('x-iksi-client-country')).toBeNull();
		expect(await seen[0].text()).toBe('x');
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
