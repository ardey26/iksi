import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
	profile: {} as any,
	update: vi.fn(async () => ({})),
	deletePrefix: vi.fn(async () => {})
}));

vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession: () => 7 }));
vi.mock('#lib/server/user-cache.js', () => ({ invalidateUserCache: vi.fn() }));
vi.mock('#lib/server/safe-browsing.js', () => ({ checkURL: vi.fn() }));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL: vi.fn() }));
vi.mock('#lib/server/avatar-url.js', () => ({
	verifyAvatarUrl: vi.fn(async (u: string) => ({ ok: true, url: u }))
}));
vi.mock('#lib/prisma.js', () => ({
	prisma: { profile: { findUnique: vi.fn(async () => h.profile), update: h.update } }
}));
vi.mock('#lib/server/media-store.js', () => ({
	r2MediaStore: () => ({ put: vi.fn(), deletePrefix: h.deletePrefix, publicUrl: (k: string) => k })
}));

import { POST } from './+server';

const CDN = 'https://cdn.iksi.app/7/avatar/u1.400.webp';
function call(avatarUrl: string) {
	return POST({
		request: new Request('http://x', {
			method: 'POST',
			body: JSON.stringify({ action: 'updateProfile', displayName: 'a', bio: '', avatarUrl, accent: '#3B82F6' })
		}),
		cookies: { get: () => 'c' }
	} as any);
}

const savedBase = process.env.MEDIA_BASE_URL;
afterEach(() => {
	if (savedBase === undefined) delete process.env.MEDIA_BASE_URL;
	else process.env.MEDIA_BASE_URL = savedBase;
});

beforeEach(() => {
	vi.clearAllMocks();
	h.profile = { id: 3, avatarUrl: CDN, avatarKey: '7/avatar/u1' };
});

describe('updateProfile media handling', () => {
	it('keeps avatarKey when the url is the stored CDN url', async () => {
		await call(CDN);
		const data = (h.update.mock.calls[0] as any)[0].data;
		expect(data.avatarUrl).toBe(CDN);
		expect('avatarKey' in data).toBe(false);
		expect(h.deletePrefix).not.toHaveBeenCalled();
	});
	it('keeps avatarKey when the url arrives on MEDIA_BASE_URL', async () => {
		process.env.MEDIA_BASE_URL = 'https://www.iksi.app/media';
		const res = await call('https://www.iksi.app/media/7/avatar/u1.400.webp');
		const data = (h.update.mock.calls[0] as any)[0].data;
		expect(data.avatarUrl).toBe(CDN);
		expect('avatarKey' in data).toBe(false);
		expect(h.deletePrefix).not.toHaveBeenCalled();
		expect((await res.json()).avatarUrl).toBe('https://www.iksi.app/media/7/avatar/u1.400.webp');
	});
	it('keeps avatarKey when a stale page submits the stored cdn url', async () => {
		process.env.MEDIA_BASE_URL = 'https://www.iksi.app/media';
		await call(CDN);
		expect('avatarKey' in (h.update.mock.calls[0] as any)[0].data).toBe(false);
		expect(h.deletePrefix).not.toHaveBeenCalled();
	});
	it('clears key and deletes when avatarUrl is empty', async () => {
		await call('');
		const data = (h.update.mock.calls[0] as any)[0].data;
		expect(data.avatarUrl).toBeNull();
		expect(data.avatarKey).toBeNull();
		expect(h.deletePrefix).toHaveBeenCalledWith('7/avatar/u1.');
	});
	it('clears key and deletes when switching to an external url', async () => {
		await call('https://example.com/a.png');
		const data = (h.update.mock.calls[0] as any)[0].data;
		expect(data.avatarUrl).toBe('https://example.com/a.png');
		expect(data.avatarKey).toBeNull();
		expect(h.deletePrefix).toHaveBeenCalledWith('7/avatar/u1.');
	});
	it('empty url with no key deletes nothing', async () => {
		h.profile = { id: 3, avatarUrl: null, avatarKey: null };
		await call('');
		expect(h.deletePrefix).not.toHaveBeenCalled();
	});
});
