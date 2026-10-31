import { env } from 'cloudflare:workers';
import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test';
import type { ClickEvent } from '@iksi/core';
import { createQueueHandler } from './consumer';
import type { Env, Upstream } from './handler';

const event = (linkId: number): ClickEvent => ({
	v: 1,
	linkId,
	ts: 1_000,
	country: 'PH',
	userAgent: 'ua',
	referer: null,
	surface: 'direct',
	profileId: null,
	rowId: null
});

const testEnv = (overrides: Partial<Env> = {}): Env => ({
	...env,
	...overrides
});

async function run(bodies: unknown[], upstream: Upstream) {
	const batch = createMessageBatch(
		'iksi-clicks',
		bodies.map((body, i) => ({
			id: `m${i}`,
			timestamp: new Date(0),
			attempts: 1,
			body
		}))
	);
	const ctx = createExecutionContext();
	await createQueueHandler({ upstream })(batch, testEnv({ EDGE_SECRET: 's3cret' }));
	return getQueueResult(batch, ctx);
}

function recorder(respond: () => Response | Promise<Response>) {
	const seen: Request[] = [];
	const upstream: Upstream = async (req) => {
		seen.push(req.clone());
		return respond();
	};
	return { upstream, seen };
}

describe('queue consumer', () => {
	it('posts valid events together and acks them on 2xx', async () => {
		const { upstream, seen } = recorder(() => new Response(null, { status: 200 }));
		const result = await run([event(1), event(2), event(3)], upstream);

		expect(seen).toHaveLength(1);
		expect(seen[0].method).toBe('POST');
		expect(seen[0].url).toBe('https://www.iksi.app/internal/ingest');
		expect(seen[0].headers.get('x-iksi-edge')).toBe('s3cret');
		const body = (await seen[0].json()) as { events: ClickEvent[] };
		expect(body.events).toHaveLength(3);
		expect(result.explicitAcks).toHaveLength(3);
		expect(result.retryMessages).toHaveLength(0);
	});

	it('retries every message on a 503', async () => {
		const { upstream } = recorder(() => new Response(null, { status: 503 }));
		const result = await run([event(1), event(2)], upstream);
		expect(result.explicitAcks).toHaveLength(0);
		expect(result.retryMessages).toHaveLength(2);
	});

	it('retries every message when the origin throws', async () => {
		const upstream: Upstream = async () => {
			throw new Error('boom');
		};
		const result = await run([event(1), event(2)], upstream);
		expect(result.explicitAcks).toHaveLength(0);
		expect(result.retryMessages).toHaveLength(2);
	});

	it('drops invalid messages but still delivers the valid ones', async () => {
		const { upstream, seen } = recorder(() => new Response(null, { status: 200 }));
		const result = await run([event(1), { v: 2 }, event(2)], upstream);
		const body = (await seen[0].json()) as { events: ClickEvent[] };
		expect(body.events).toHaveLength(2);
		expect(result.explicitAcks).toHaveLength(3);
		expect(result.retryMessages).toHaveLength(0);
	});

	it('acks invalid messages even when ingest fails', async () => {
		const { upstream } = recorder(() => new Response(null, { status: 500 }));
		const result = await run([event(1), { v: 2 }], upstream);
		expect(result.explicitAcks).toEqual(['m1']);
		expect(result.retryMessages.map((m) => m.msgId)).toEqual(['m0']);
	});

	it('makes no request when every message is invalid', async () => {
		const { upstream, seen } = recorder(() => new Response(null, { status: 200 }));
		const result = await run([{ v: 2 }, 'junk'], upstream);
		expect(seen).toHaveLength(0);
		expect(result.explicitAcks).toHaveLength(2);
	});

	it('delays retries by 30 seconds', async () => {
		const retry = vi.fn();
		const batch = {
			queue: 'iksi-clicks',
			messages: [
				{
					id: 'a',
					timestamp: new Date(0),
					attempts: 1,
					body: event(1),
					ack() {},
					retry
				}
			]
		} as unknown as MessageBatch<unknown>;
		const upstream: Upstream = async () => new Response(null, { status: 503 });
		await createQueueHandler({ upstream })(batch, testEnv());
		expect(retry).toHaveBeenCalledWith({ delaySeconds: 30 });
	});

	it('posts to ORIGIN_URL when set', async () => {
		const { upstream, seen } = recorder(() => new Response(null, { status: 200 }));
		const batch = createMessageBatch('iksi-clicks', [
			{ id: 'm0', timestamp: new Date(0), attempts: 1, body: event(1) }
		]);
		await createQueueHandler({ upstream })(batch, testEnv({ ORIGIN_URL: 'https://origin.test' }));
		expect(seen[0].url).toBe('https://origin.test/internal/ingest');
	});
});
