import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

const h = vi.hoisted(() => ({
	uid: 7 as number | null,
	allowed: true,
	profile: { id: 3, avatarKey: null as string | null, backgroundKey: null as string | null } as any,
	update: vi.fn(async () => ({})),
	deletePrefix: vi.fn(async () => {}),
	put: vi.fn(async () => {})
}));

vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession: () => h.uid }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit: vi.fn(async () => ({ allowed: h.allowed })) }));
vi.mock('#lib/server/user-cache.js', () => ({ invalidateUserCache: vi.fn() }));
vi.mock('#lib/prisma.js', () => ({
	prisma: { profile: { findUnique: vi.fn(async () => h.profile), update: h.update } }
}));
vi.mock('#lib/server/media-store.js', () => ({
	r2MediaStore: () => ({
		put: h.put,
		deletePrefix: h.deletePrefix,
		publicUrl: (k: string) => `https://cdn.iksi.app/${k}`
	})
}));

import { POST, DELETE } from './+server';

async function png() {
	return await sharp({ create: { width: 50, height: 50, channels: 3, background: '#0f0' } }).png().toBuffer();
}
async function post(file: Blob, kind: string) {
	const fd = new FormData();
	fd.set('file', file, 'x');
	fd.set('kind', kind);
	return POST({ request: new Request('http://x/api/media', { method: 'POST', body: fd }), cookies: { get: () => 'c' } } as any);
}
function del(kind: string) {
	return DELETE({ url: new URL(`http://x/api/media?kind=${kind}`), cookies: { get: () => 'c' } } as any);
}

beforeEach(() => {
	h.uid = 7;
	h.allowed = true;
	h.profile = { id: 3, avatarKey: null, backgroundKey: null };
	vi.clearAllMocks();
});

describe('/api/media', () => {
	it('401 when unsigned', async () => {
		h.uid = null;
		expect((await post(new Blob([await png()]), 'avatar')).status).toBe(401);
	});
	it('429 when rate limited', async () => {
		h.allowed = false;
		expect((await post(new Blob([await png()]), 'avatar')).status).toBe(429);
	});
	it('400 unsupported for a text file', async () => {
		const res = await post(new Blob(['hello world']), 'avatar');
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code: 'unsupported' });
	});
	it.each([
		['too_large', 'Images must be under 4 MB.'],
		['unsupported', 'Use a JPEG, PNG, WebP, GIF or AVIF image.'],
		['too_many_pixels', 'Images must be 8000 px or smaller on each side.'],
		['empty', 'That file is empty.']
	])('maps %s to friendly text', async (code, text) => {
		const { MediaError } = await import('#lib/server/media.js');
		h.put.mockImplementationOnce(async () => {
			throw new MediaError(code as any);
		});
		const res = await post(new Blob([await png()]), 'avatar');
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: text, code });
	});
	it('400 for a bad kind', async () => {
		expect((await post(new Blob([await png()]), 'banner')).status).toBe(400);
	});
	it('404 when the user has no profile', async () => {
		h.profile = null;
		expect((await post(new Blob([await png()]), 'avatar')).status).toBe(404);
	});
	it('200 with url for a valid png', async () => {
		const res = await post(new Blob([await png()]), 'avatar');
		expect(res.status).toBe(200);
		const { url } = await res.json();
		expect(url).toMatch(/^https:\/\/cdn\.iksi\.app\/7\/avatar\/.+\.400\.webp$/);
		expect(h.put).toHaveBeenCalledTimes(2);
	});
	it('DELETE 204', async () => {
		h.profile = { id: 3, avatarKey: '7/avatar/u1', backgroundKey: null };
		expect((await del('avatar')).status).toBe(204);
		expect(h.deletePrefix).toHaveBeenCalledWith('7/avatar/u1.');
	});
});
