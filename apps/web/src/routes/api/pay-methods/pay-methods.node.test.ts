import { describe, it, expect, vi, beforeEach } from 'vitest';
import QRCode from 'qrcode';
import { damagedPayload, payQrPayload } from '../../../test/pay-qr';

const UPDATED = new Date('2026-11-01T00:00:00Z');
const h = vi.hoisted(() => ({
	uid: 7 as number | null,
	allowed: true,
	profile: null as any,
	updateMany: vi.fn(async (..._a: any[]) => ({ count: 1 })),
	update: vi.fn(async (..._a: any[]) => ({})),
	r2MediaStore: vi.fn(),
	cacheDelete: vi.fn(async () => {})
}));

vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession: () => h.uid }));
vi.mock('@vercel/functions', () => ({ dangerouslyDeleteByTag: h.cacheDelete, addCacheTag: vi.fn(), waitUntil: vi.fn() }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit: vi.fn(async () => ({ allowed: h.allowed })) }));
vi.mock('#lib/prisma.js', () => ({
	prisma: { profile: { findUnique: vi.fn(async () => h.profile), updateMany: h.updateMany, update: h.update } }
}));
// Uploads are decoded in memory; the media store must never be reached.
vi.mock('#lib/server/media-store.js', () => ({ r2MediaStore: h.r2MediaStore }));

import { POST, DELETE, PATCH } from './+server';

const qrPng = async (text: string) => new Blob([await QRCode.toBuffer(text, { type: 'png', width: 400, margin: 4 })]);
const event = (request: Request) => ({ request, url: new URL(request.url), cookies: { get: () => 'c' } }) as any;

async function upload(file: Blob, provider?: string) {
	const fd = new FormData();
	fd.set('kind', 'qr');
	fd.set('file', file, 'qr.png');
	if (provider) fd.set('provider', provider);
	return POST(event(new Request('http://x/api/pay-methods', { method: 'POST', body: fd })));
}
async function addLink(url: string) {
	const fd = new FormData();
	fd.set('kind', 'link');
	fd.set('url', url);
	return POST(event(new Request('http://x/api/pay-methods', { method: 'POST', body: fd })));
}
const del = (id: string) => DELETE(event(new Request(`http://x/api/pay-methods?id=${id}`, { method: 'DELETE' })));
const patch = (body: unknown) =>
	PATCH(event(new Request('http://x/api/pay-methods', { method: 'PATCH', body: JSON.stringify(body) })));

const stored = (n: number) =>
	Array.from({ length: n }, (_, i) => ({ id: `m${i}`, kind: 'link', provider: 'kofi', url: `https://ko-fi.com/u${i}` }));
const savedMethods = () => (h.updateMany.mock.calls[0][0] as any).data.payMethods;

beforeEach(() => {
	vi.clearAllMocks();
	h.uid = 7;
	h.allowed = true;
	h.profile = { id: 3, payMethods: null, payLabel: null, updatedAt: UPDATED };
	h.updateMany.mockResolvedValue({ count: 1 });
});

describe('POST /api/pay-methods: upload a QR image', () => {
	it('stores a payment QR as payload text and clears the cached profile', async () => {
		const payload = payQrPayload();
		const res = await upload(await qrPng(payload));
		expect(res.status).toBe(200);
		expect(h.updateMany).toHaveBeenCalledWith({
			where: { id: 3, updatedAt: UPDATED },
			data: { payMethods: [expect.objectContaining({ kind: 'qr', payload, name: 'JUAN DELA CRUZ' })] }
		});
		const body = await res.json();
		expect(body.methods).toEqual([expect.objectContaining({ kind: 'qr', name: 'JUAN DELA CRUZ', country: 'PH', currency: 'PHP' })]);
		expect(body.label).toBe('pay');
		expect(h.cacheDelete).toHaveBeenCalledWith('profile-7');
	});

	it('names the QR by the bank its BIC identifies, and says which method was added', async () => {
		const res = await upload(await qrPng(payQrPayload({ bic: 'LAUIPHM2XXX' })));
		expect(res.status).toBe(200);
		const [saved] = savedMethods();
		expect(saved).toMatchObject({ kind: 'qr', bic: 'LAUIPHM2XXX', institution: 'maribank', label: 'MariBank' });
		expect((await res.json()).added).toBe(saved.id);
	});

	it('calls a QR from an unknown bank Bank QR', async () => {
		const res = await upload(await qrPng(payQrPayload({ bic: 'BOPIPHMMXXX' })));
		expect(res.status).toBe(200);
		const [saved] = savedMethods();
		expect(saved).toMatchObject({ kind: 'qr', label: 'Bank QR' });
		expect(saved).not.toHaveProperty('institution');
	});

	it('ignores a bank chosen by an older dashboard', async () => {
		await upload(await qrPng(payQrPayload({ bic: 'BOPIPHMMXXX' })), 'maya');
		expect(savedMethods()[0]).not.toHaveProperty('institution');
	});

	it('keeps the stored methods, in the new shape, when adding to an older list', async () => {
		h.profile.payMethods = [{ id: 'old', kind: 'qr', provider: 'gcash', payload: payQrPayload(), name: 'X', city: null, country: 'PH', currency: 'PHP' }];
		await upload(await qrPng(payQrPayload({ bic: 'LAUIPHM2XXX' })));
		const [old, added] = savedMethods();
		expect(old).toMatchObject({ id: 'old', institution: 'gcash', label: 'GCash' });
		expect(old).not.toHaveProperty('provider');
		expect(added).toMatchObject({ institution: 'maribank' });
	});

	it('stores a QR holding a Venmo link as a link method', async () => {
		const res = await upload(await qrPng('https://venmo.com/u/ana-reyes'));
		expect(res.status).toBe(200);
		expect(savedMethods()).toEqual([
			expect.objectContaining({ kind: 'link', provider: 'venmo', url: 'https://venmo.com/u/ana-reyes' })
		]);
	});

	it.each([
		['a link that is not on the allow-list', 'https://example.com/menu', "That QR isn't a payment QR or a supported payment link."],
		['a payment QR with a wrong checksum', damagedPayload(), 'That QR is damaged and cannot be read. Save a fresh copy from your app and try again.']
	])('refuses %s with a message and changes nothing', async (_name, text, message) => {
		const res = await upload(await qrPng(text));
		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe(message);
		expect(h.updateMany).not.toHaveBeenCalled();
		expect(h.cacheDelete).not.toHaveBeenCalled();
	});

	it('refuses a file that is not an image', async () => {
		const res = await upload(new Blob(['hello']));
		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe('Use a JPEG, PNG, WebP, GIF or AVIF image.');
	});

	it('refuses a seventh method', async () => {
		h.profile.payMethods = stored(6);
		const res = await upload(await qrPng(payQrPayload()));
		expect(res.status).toBe(400);
		expect((await res.json()).code).toBe('too_many');
		expect(h.updateMany).not.toHaveBeenCalled();
	});

	it('refuses when the profile changed since it was read', async () => {
		h.updateMany.mockResolvedValue({ count: 0 });
		const res = await upload(await qrPng(payQrPayload()));
		expect(res.status).toBe(409);
		expect(h.cacheDelete).not.toHaveBeenCalled();
	});
});

describe('POST /api/pay-methods: paste a link', () => {
	it('adds an allowed link after the existing methods', async () => {
		h.profile.payMethods = stored(1);
		const res = await addLink('https://paypal.me/ana');
		expect(res.status).toBe(200);
		expect(savedMethods().map((m: any) => m.url)).toEqual(['https://ko-fi.com/u0', 'https://paypal.me/ana']);
		expect(h.cacheDelete).toHaveBeenCalledWith('profile-7');
	});

	it.each([
		['https://paypal.me.evil.com/ana', 'Use a link from PayPal, Venmo, Cash App, Wise, Revolut, Ko-fi, Buy Me a Coffee or Stripe.'],
		['http://paypal.me/ana', 'Payment links must start with https://.']
	])('refuses %s', async (url, message) => {
		const res = await addLink(url);
		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe(message);
		expect(h.updateMany).not.toHaveBeenCalled();
	});
});

describe('no upload path reaches the media store', () => {
	it('never creates a media store', async () => {
		await upload(await qrPng(payQrPayload()));
		await upload(await qrPng('https://cash.app/$ana'));
		await upload(await qrPng('https://example.com/'));
		await upload(new Blob(['x']));
		await addLink('https://paypal.me/ana');
		expect(h.r2MediaStore).not.toHaveBeenCalled();
	});
});

describe('DELETE /api/pay-methods', () => {
	it('removes the method and clears the cached profile', async () => {
		h.profile.payMethods = stored(2);
		const res = await del('m0');
		expect(res.status).toBe(200);
		expect(savedMethods().map((m: any) => m.id)).toEqual(['m1']);
		expect(h.cacheDelete).toHaveBeenCalledWith('profile-7');
	});

	it('is a 404 for an unknown id', async () => {
		h.profile.payMethods = stored(1);
		const res = await del('nope');
		expect(res.status).toBe(404);
		expect(h.cacheDelete).not.toHaveBeenCalled();
	});
});

describe('PATCH /api/pay-methods', () => {
	it('sets the button label and clears the cached profile', async () => {
		const res = await patch({ label: 'tip' });
		expect(res.status).toBe(200);
		expect(h.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { payLabel: 'tip' } });
		expect((await res.json()).label).toBe('tip');
		expect(h.cacheDelete).toHaveBeenCalledWith('profile-7');
	});

	it('saves a new order and clears the cached profile', async () => {
		h.profile.payMethods = stored(3);
		const res = await patch({ order: ['m2', 'm0', 'm1'] });
		expect(res.status).toBe(200);
		expect(h.updateMany).toHaveBeenCalledWith({
			where: { id: 3, updatedAt: UPDATED },
			data: { payMethods: [expect.objectContaining({ id: 'm2' }), expect.objectContaining({ id: 'm0' }), expect.objectContaining({ id: 'm1' })] }
		});
		expect((await res.json()).methods.map((m: any) => m.id)).toEqual(['m2', 'm0', 'm1']);
		expect(h.cacheDelete).toHaveBeenCalledWith('profile-7');
	});

	it('refuses an order that is not the current methods', async () => {
		h.profile.payMethods = stored(3);
		const res = await patch({ order: ['m2', 'm0'] });
		expect(res.status).toBe(409);
		expect(h.updateMany).not.toHaveBeenCalled();
		expect(h.cacheDelete).not.toHaveBeenCalled();
	});

	it('refuses a reorder when the profile changed since it was read', async () => {
		h.profile.payMethods = stored(2);
		h.updateMany.mockResolvedValue({ count: 0 });
		expect((await patch({ order: ['m1', 'm0'] })).status).toBe(409);
	});

	it('refuses an unknown label', async () => {
		const res = await patch({ label: 'donate' });
		expect(res.status).toBe(400);
		expect(h.update).not.toHaveBeenCalled();
	});
});

describe('PATCH /api/pay-methods: rename a QR', () => {
	const qrs = () => [
		{ id: 'q1', kind: 'qr', payload: payQrPayload(), name: 'X', city: null, country: 'PH', currency: 'PHP', label: 'GCash', institution: 'gcash' },
		{ id: 'l1', kind: 'link', provider: 'kofi', url: 'https://ko-fi.com/ann' }
	];
	beforeEach(() => {
		h.profile.payMethods = qrs();
	});

	it('saves the new name and clears the cached profile', async () => {
		const res = await patch({ rename: { id: 'q1', label: ' Shop ' } });
		expect(res.status).toBe(200);
		expect(h.updateMany).toHaveBeenCalledWith({
			where: { id: 3, updatedAt: UPDATED },
			data: { payMethods: [expect.objectContaining({ id: 'q1', label: 'Shop', institution: 'gcash' }), expect.objectContaining({ id: 'l1' })] }
		});
		expect((await res.json()).methods[0].label).toBe('Shop');
		expect(h.cacheDelete).toHaveBeenCalledWith('profile-7');
	});

	it('puts the bank name back for an empty name', async () => {
		h.profile.payMethods = [{ ...qrs()[0], label: 'Shop' }];
		await patch({ rename: { id: 'q1', label: '' } });
		expect(savedMethods()[0].label).toBe('GCash');
	});

	it('refuses a name that is too long or not plain text', async () => {
		for (const label of ['x'.repeat(25), '<b>Shop</b>']) {
			const res = await patch({ rename: { id: 'q1', label } });
			expect(res.status).toBe(400);
			expect((await res.json()).error).toBe('Names can be up to 24 characters of plain text.');
		}
		expect(h.updateMany).not.toHaveBeenCalled();
		expect(h.cacheDelete).not.toHaveBeenCalled();
	});

	it('is a 404 for an unknown method or a link', async () => {
		expect((await patch({ rename: { id: 'nope', label: 'Shop' } })).status).toBe(404);
		expect((await patch({ rename: { id: 'l1', label: 'Shop' } })).status).toBe(404);
		expect((await patch({ rename: 'q1' })).status).toBe(404);
		expect(h.updateMany).not.toHaveBeenCalled();
	});

	it('refuses when the profile changed since it was read', async () => {
		h.updateMany.mockResolvedValue({ count: 0 });
		expect((await patch({ rename: { id: 'q1', label: 'Shop' } })).status).toBe(409);
		expect(h.cacheDelete).not.toHaveBeenCalled();
	});
});

describe('access', () => {
	it('requires a session', async () => {
		h.uid = null;
		expect((await addLink('https://paypal.me/ana')).status).toBe(401);
		expect((await del('m0')).status).toBe(401);
		expect((await patch({ label: 'tip' })).status).toBe(401);
	});

	it('rate limits additions', async () => {
		h.allowed = false;
		expect((await addLink('https://paypal.me/ana')).status).toBe(429);
	});

	it('is a 404 without a profile', async () => {
		h.profile = null;
		expect((await addLink('https://paypal.me/ana')).status).toBe(404);
	});
});
