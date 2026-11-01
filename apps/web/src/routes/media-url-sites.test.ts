// Stored cdn.iksi.app URLs must reach every page and response on MEDIA_BASE_URL.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
	userFindUnique: vi.fn(),
	profileFindUnique: vi.fn(),
	handleFindUnique: vi.fn()
}));

vi.mock('#lib/prisma.js', () => ({
	prisma: {
		user: { findUnique: h.userFindUnique },
		profile: { findUnique: h.profileFindUnique },
		handle: { findUnique: h.handleFindUnique },
		rateLimit: {
			findUnique: vi.fn(async () => null),
			upsert: vi.fn(async () => ({})),
			update: vi.fn(async () => ({}))
		}
	}
}));
vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession: () => 7 }));
vi.mock('#lib/server/user-cache.js', () => ({ getCachedUser: () => undefined, setCachedUser: () => {} }));
vi.mock('#lib/server/client.js', () => ({ clientOf: () => ({ ip: '1.2.3.4' }) }));

import { load as layoutLoad } from './+layout.server';
import { load as dashboardProfileLoad } from './(app)/dashboard/profile/+page.server';
import { GET as profileJson } from './api/@[handle]/+server';

const OLD_AVATAR = 'https://cdn.iksi.app/7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp';
const NEW_AVATAR = 'https://www.iksi.app/media/7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp';
const OLD_BG = 'https://cdn.iksi.app/7/background/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.1600.webp';
const NEW_BG = 'https://www.iksi.app/media/7/background/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.1600.webp';

const saved = process.env.MEDIA_BASE_URL;
beforeEach(() => {
	vi.clearAllMocks();
	process.env.MEDIA_BASE_URL = 'https://www.iksi.app/media';
});
afterEach(() => {
	if (saved === undefined) delete process.env.MEDIA_BASE_URL;
	else process.env.MEDIA_BASE_URL = saved;
});

describe('stored media urls are served from MEDIA_BASE_URL', () => {
	it('root layout user avatar', async () => {
		h.userFindUnique.mockResolvedValue({
			id: 7,
			twitterHandle: null,
			googleEmail: null,
			handle: { handle: 'ann' },
			profile: { id: 3, displayName: 'Ann', avatarUrl: OLD_AVATAR }
		});
		const out = (await layoutLoad({ cookies: { get: () => 'c' }, route: { id: '/' } } as never)) as {
			user: { avatarUrl: string };
		};
		expect(out.user.avatarUrl).toBe(NEW_AVATAR);
	});

	it('dashboard profile avatar and background', async () => {
		h.profileFindUnique.mockResolvedValue({ avatarUrl: OLD_AVATAR, backgroundUrl: OLD_BG });
		const out = (await dashboardProfileLoad({ parent: async () => ({ user: { id: 7 } }) } as never)) as {
			profile: { avatarUrl: string; backgroundUrl: string };
		};
		expect(out.profile.avatarUrl).toBe(NEW_AVATAR);
		expect(out.profile.backgroundUrl).toBe(NEW_BG);
	});

	it('public profile JSON avatar', async () => {
		h.handleFindUnique.mockResolvedValue({
			user: { profile: { displayName: 'Ann', bio: null, avatarUrl: OLD_AVATAR, rows: [], publicClicks: false } }
		});
		const res = await profileJson({ params: { handle: 'ann' } } as never);
		expect((await res.json()).avatarUrl).toBe(NEW_AVATAR);
	});

	it('leaves external avatars alone', async () => {
		const google = 'https://lh3.googleusercontent.com/a/abc=s400-c';
		h.profileFindUnique.mockResolvedValue({ avatarUrl: google, backgroundUrl: null });
		const out = (await dashboardProfileLoad({ parent: async () => ({ user: { id: 7 } }) } as never)) as {
			profile: { avatarUrl: string; backgroundUrl: string | null };
		};
		expect(out.profile.avatarUrl).toBe(google);
		expect(out.profile.backgroundUrl).toBeNull();
	});
});
