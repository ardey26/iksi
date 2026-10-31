import type { LinkLookup, LinkRecord, LinkStore } from '@iksi/core';
import { refreshLink, resolveLink, STALE_AFTER_MS } from './resolve';
import type { Upstream } from './handler';

const record: LinkRecord = {
	v: 2,
	id: 7,
	destination: 'https://example.com/a',
	flagged: false,
	permanent: false
};
const NOW = 10_000_000;

function memoryStore(initial?: LinkLookup) {
	let entry: LinkLookup = initial ?? { kind: 'unknown' };
	const writes: string[] = [];
	const store: LinkStore = {
		async get() {
			return entry;
		},
		async putFound(_h, _s, r, now) {
			writes.push('found');
			entry = { kind: 'found', stored: { record: r, storedAt: now } };
		},
		async putMissing() {
			writes.push('missing');
			entry = { kind: 'missing' };
		},
		async delete() {
			writes.push('delete');
			entry = { kind: 'unknown' };
		}
	};
	return { store, writes, current: () => entry };
}

function origin(respond: (req: Request) => Response | Promise<Response>) {
	const seen: Request[] = [];
	const upstream: Upstream = async (req) => {
		seen.push(req);
		return respond(req);
	};
	return { upstream, seen };
}

const deps = (upstream: Upstream) => ({
	upstream,
	origin: 'https://www.iksi.app',
	secret: 's3cret',
	now: NOW,
	defer: (p: Promise<unknown>) => void p
});

const found = (storedAt: number): LinkLookup => ({
	kind: 'found',
	stored: { record, storedAt }
});

test('fresh store hit is found, not stale, origin untouched', async () => {
	const { store } = memoryStore(found(NOW - 1000));
	const { upstream, seen } = origin(() => new Response('x'));
	expect(await resolveLink('iksi.app', 'AbC', store, deps(upstream))).toEqual({
		kind: 'found',
		record,
		stale: false
	});
	expect(seen).toHaveLength(0);
});

test('store hit older than the stale window is flagged stale', async () => {
	const { store } = memoryStore(found(NOW - STALE_AFTER_MS - 1));
	const { upstream } = origin(() => new Response('x'));
	expect(await resolveLink('iksi.app', 'AbC', store, deps(upstream))).toMatchObject({
		kind: 'found',
		stale: true
	});
});

test('store missing is missing, origin untouched', async () => {
	const { store } = memoryStore({ kind: 'missing' });
	const { upstream, seen } = origin(() => new Response('x'));
	expect(await resolveLink('iksi.app', 'AbC', store, deps(upstream))).toEqual({
		kind: 'missing'
	});
	expect(seen).toHaveLength(0);
});

test('unknown + origin 200 resolves, stores the record and signs the call', async () => {
	const m = memoryStore();
	const { upstream, seen } = origin(() => Response.json({ found: true, record }));
	expect(await resolveLink('iksi.app', 'AbC', m.store, deps(upstream))).toEqual({
		kind: 'found',
		record,
		stale: false
	});
	expect(m.current()).toEqual(found(NOW));
	expect(seen[0].url).toBe('https://www.iksi.app/internal/resolve?slug=AbC');
	expect(seen[0].headers.get('x-iksi-internal')).toBe('s3cret');
	expect(seen[0].headers.get('x-iksi-edge')).toBeNull();
});

test('unknown + origin 404 is missing and writes a negative entry', async () => {
	const m = memoryStore();
	const { upstream } = origin(() => Response.json({ found: false }, { status: 404 }));
	expect(await resolveLink('iksi.app', 'AbC', m.store, deps(upstream))).toEqual({
		kind: 'missing'
	});
	expect(m.current()).toEqual({ kind: 'missing' });
});

test.each([
	['500', () => new Response('boom', { status: 500 })],
	[
		'throw',
		() => {
			throw new Error('down');
		}
	],
	['invalid record', () => Response.json({ found: true, record: { v: 1 } })],
	['future record version', () => Response.json({ found: true, record: { ...record, v: 3 } })],
	[
		'v1 record carrying settings',
		() => Response.json({ found: true, record: { ...record, v: 1, protected: true } })
	],
	['non-json', () => new Response('<html>', { status: 200 })]
])('unknown + origin %s is unavailable and store unchanged', async (_name, respond) => {
	const m = memoryStore();
	const { upstream } = origin(respond);
	expect(await resolveLink('iksi.app', 'AbC', m.store, deps(upstream))).toEqual({
		kind: 'unavailable'
	});
	expect(m.writes).toEqual([]);
});

test('refreshLink with origin 404 deletes the found entry and writes a negative one', async () => {
	const m = memoryStore(found(0));
	const { upstream } = origin(() => Response.json({ found: false }, { status: 404 }));
	await refreshLink('iksi.app', 'AbC', m.store, deps(upstream));
	expect(m.writes).toEqual(['delete', 'missing']);
	expect(m.current()).toEqual({ kind: 'missing' });
});

test('refreshLink with origin 200 rewrites with the new time and record', async () => {
	const m = memoryStore(found(0));
	const next = { ...record, destination: 'https://example.com/b' };
	const { upstream } = origin(() => Response.json({ found: true, record: next }));
	await refreshLink('iksi.app', 'AbC', m.store, deps(upstream));
	expect(m.current()).toEqual({
		kind: 'found',
		stored: { record: next, storedAt: NOW }
	});
});

test('refreshLink leaves the entry alone when origin fails', async () => {
	const m = memoryStore(found(0));
	const { upstream } = origin(() => new Response('x', { status: 500 }));
	await refreshLink('iksi.app', 'AbC', m.store, deps(upstream));
	expect(m.writes).toEqual([]);
});

describe('store failures', () => {
	const throwing = (which: 'get' | 'putFound' | 'putMissing'): LinkStore => {
		const m = memoryStore().store;
		return {
			...m,
			[which]: async () => {
				throw new Error('kv 429');
			}
		};
	};
	const quietly = () => vi.spyOn(console, 'error').mockImplementation(() => {});

	test('a throwing get reads as unknown and asks origin', async () => {
		const log = quietly();
		const { upstream, seen } = origin(() => Response.json({ found: true, record }));
		const res = await resolveLink('iksi.app', 'AbC', throwing('get'), {
			...deps(upstream),
			defer: () => {}
		});
		expect(res).toMatchObject({ kind: 'found', record });
		expect(seen).toHaveLength(1);
		expect(log).toHaveBeenCalled();
		log.mockRestore();
	});

	test('putFound is deferred and its failure is logged, not thrown', async () => {
		const log = quietly();
		const deferred: Promise<unknown>[] = [];
		const { upstream } = origin(() => Response.json({ found: true, record }));
		const res = await resolveLink('iksi.app', 'AbC', throwing('putFound'), {
			...deps(upstream),
			defer: (p) => deferred.push(p)
		});
		expect(res).toMatchObject({ kind: 'found' });
		expect(deferred).toHaveLength(1);
		await expect(Promise.all(deferred)).resolves.toBeDefined();
		expect(log).toHaveBeenCalled();
		log.mockRestore();
	});

	test('putMissing failure still answers missing', async () => {
		const log = quietly();
		const deferred: Promise<unknown>[] = [];
		const { upstream } = origin(() => new Response('{}', { status: 404 }));
		const res = await resolveLink('iksi.app', 'AbC', throwing('putMissing'), {
			...deps(upstream),
			defer: (p) => deferred.push(p)
		});
		expect(res).toEqual({ kind: 'missing' });
		await Promise.all(deferred);
		log.mockRestore();
	});

	test('origin trouble is logged with the slug', async () => {
		const log = quietly();
		const { upstream } = origin(() => {
			throw new Error('down');
		});
		await resolveLink('iksi.app', 'AbC', memoryStore().store, {
			...deps(upstream),
			defer: () => {}
		});
		expect(log).toHaveBeenCalledWith(expect.stringContaining('AbC'), expect.anything());
		log.mockRestore();
	});

	test('refreshLink write failure is logged, not thrown', async () => {
		const log = quietly();
		const { upstream } = origin(() => Response.json({ found: true, record }));
		await expect(
			refreshLink('iksi.app', 'AbC', throwing('putFound'), { ...deps(upstream), defer: () => {} })
		).resolves.toBeUndefined();
		log.mockRestore();
	});
});
