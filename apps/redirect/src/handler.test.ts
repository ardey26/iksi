import { createHandler, type Upstream } from './handler';

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

/** Records every request the Worker forwards and answers with a canned response. */
function recordingUpstream(respond: (req: Request) => Response | Promise<Response>) {
	const seen: Request[] = [];
	const upstream: Upstream = async (req) => {
		seen.push(req.clone());
		return respond(req);
	};
	return { upstream, seen };
}

test('health is answered locally, origin is not called', async () => {
	const { upstream, seen } = recordingUpstream(() => new Response('origin'));
	const res = await createHandler(upstream)(new Request('https://www.iksi.app/_health'), {}, ctx);
	expect(res.status).toBe(200);
	expect(res.headers.get('cache-control')).toBe('no-store');
	expect(await res.json()).toMatchObject({ ok: true, version: 'dev' });
	expect(seen).toHaveLength(0);
});

test('slug passes through and is tagged', async () => {
	const { upstream, seen } = recordingUpstream(
		() => new Response(null, { status: 302, headers: { location: 'https://example.com' } })
	);
	const res = await createHandler(upstream)(new Request('https://www.iksi.app/QdM2whH'), {}, ctx);
	expect(res.status).toBe(302);
	expect(res.headers.get('x-iksi-route')).toBe('slug');
	expect(res.headers.get('location')).toBe('https://example.com');
	expect(seen[0].url).toBe('https://www.iksi.app/QdM2whH');
});

test('POST with body and query passes through intact', async () => {
	const { upstream, seen } = recordingUpstream(() => new Response('ok'));
	const res = await createHandler(upstream)(
		new Request('https://www.iksi.app/api/shorten?x=1', {
			method: 'POST',
			body: '{"longURL":"https://a.b"}',
			headers: { 'content-type': 'application/json' }
		}),
		{},
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
	const res = await createHandler(upstream)(
		new Request('https://www.iksi.app/QdM2whH', { method: 'HEAD' }),
		{},
		ctx
	);
	expect(res.status).toBe(302);
	expect(seen[0].method).toBe('HEAD');
});

test('origin failure yields 502, not an exception', async () => {
	const { upstream } = recordingUpstream(() => {
		throw new Error('ECONNRESET');
	});
	const res = await createHandler(upstream)(new Request('https://www.iksi.app/abc'), {}, ctx);
	expect(res.status).toBe(502);
	expect(res.headers.get('retry-after')).toBe('5');
	expect(res.headers.get('x-iksi-route')).toBe('slug');
});

test('root is tagged root', async () => {
	const { upstream } = recordingUpstream(() => new Response('<html>'));
	const res = await createHandler(upstream)(new Request('https://www.iksi.app/'), {}, ctx);
	expect(res.headers.get('x-iksi-route')).toBe('root');
	expect(await res.text()).toBe('<html>');
});

test('unknown paths still reach origin and are tagged unknown', async () => {
	const { upstream, seen } = recordingUpstream(() => new Response('nf', { status: 404 }));
	const res = await createHandler(upstream)(new Request('https://www.iksi.app/abc/def'), {}, ctx);
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
		await createHandler(upstream)(visitor(), { EDGE_SECRET: 's3cret' }, ctx);
		expect(seen[0].headers.get('x-iksi-edge')).toBe('s3cret');
		expect(seen[0].headers.get('x-iksi-client-ip')).toBe('198.51.100.7');
		expect(seen[0].headers.get('x-iksi-client-country')).toBe('SG');
	});

	test('drops client-supplied x-iksi headers so they cannot be spoofed', async () => {
		const { upstream, seen } = recordingUpstream(() => new Response('ok'));
		const spoofed = new Request('https://www.iksi.app/api/shorten', {
			method: 'POST',
			body: 'x',
			headers: { 'x-iksi-edge': 'guess', 'x-iksi-client-ip': '6.6.6.6', 'x-iksi-client-country': 'KP' }
		});
		await createHandler(upstream)(spoofed, {}, ctx);
		expect(seen[0].headers.get('x-iksi-edge')).toBeNull();
		expect(seen[0].headers.get('x-iksi-client-ip')).toBeNull();
		expect(seen[0].headers.get('x-iksi-client-country')).toBeNull();
		expect(await seen[0].text()).toBe('x');
	});
});
