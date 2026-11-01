import { describe, it, expect, vi, beforeEach } from 'vitest';
import { payQrPayload } from '../../../../test/pay-qr';

const h = vi.hoisted(() => ({
	profile: null as any,
	allowed: true,
	findFirst: vi.fn(),
	rateLimit: vi.fn()
}));
vi.mock('#lib/prisma.js', () => ({ prisma: { profile: { findFirst: h.findFirst } } }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit: h.rateLimit }));

import { GET } from './+server';
import { hashIp } from '#lib/server/ip-hash.js';

// Rate-limit keys hold a keyed hash of the IP, so hashing needs a key.
process.env.SECRET_KEY ||= 'k'.repeat(32);


const run = (handle = 'ann') =>
	GET({
		params: { handle },
		request: new Request(`http://x/api/@${handle}/pay`),
		getClientAddress: () => '203.0.113.9'
	} as any);

beforeEach(() => {
	vi.clearAllMocks();
	h.allowed = true;
	h.findFirst.mockImplementation(async () => h.profile);
	h.rateLimit.mockImplementation(async () => ({ allowed: h.allowed }));
});

describe('GET /api/@handle/pay', () => {
	it("returns the QR payloads of the profile's methods, by id", async () => {
		const payload = payQrPayload();
		h.profile = {
			payMethods: [
				{ id: 'q1', kind: 'qr', payload },
				{ id: 'l1', kind: 'link', provider: 'kofi', url: 'https://ko-fi.com/ann' }
			]
		};
		const res = await run('ANN');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ payloads: { q1: payload } });
		expect(h.findFirst.mock.calls[0][0].where).toEqual({ user: { handle: { handle: 'ann' } } });
	});

	it('is never cached, so a payload only reaches whoever opens Pay', async () => {
		h.profile = { payMethods: [{ id: 'q1', kind: 'qr', payload: payQrPayload() }] };
		const res = await run();
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(res.headers.get('x-robots-tag')).toBe('noindex');
	});

	it('never returns a stored payload that no longer validates', async () => {
		h.profile = { payMethods: [{ id: 'q1', kind: 'qr', payload: '000201broken' }] };
		expect(await (await run()).json()).toEqual({ payloads: {} });
	});

	it('is a 404 for a handle without a profile', async () => {
		h.profile = null;
		const res = await run('nobody');
		expect(res.status).toBe(404);
	});

	it('rate limits by a keyed hash of the visitor, never the raw IP', async () => {
		h.allowed = false;
		h.profile = { payMethods: [] };
		expect((await run()).status).toBe(429);
		expect(h.rateLimit).toHaveBeenCalledWith(`pay-qr:ip:${hashIp('203.0.113.9')}`, 120, 3_600_000);
		expect(h.rateLimit.mock.calls[0][0]).not.toContain('203.0.113.9');
	});
});
