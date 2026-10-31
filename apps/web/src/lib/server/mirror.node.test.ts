import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { mirrorAvatars } from './mirror';
import type { ProfileMediaDb } from './profile-media';
import type { MediaStore } from './media-store';

async function png() {
	return new Uint8Array(
		await sharp({ create: { width: 50, height: 50, channels: 3, background: '#0f0' } })
			.png()
			.toBuffer()
	);
}

function setup(fetchImage: (url: string) => Promise<Uint8Array>, dryRun = false) {
	const db: ProfileMediaDb = {
		current: vi.fn(async (userId: number) => ({
			profileId: userId * 10,
			avatarKey: null,
			backgroundKey: null
		})),
		setAvatar: vi.fn(async () => {}),
		setBackground: vi.fn(async () => {})
	};
	const store: MediaStore = {
		put: vi.fn(async () => {}),
		deletePrefix: vi.fn(async () => {}),
		publicUrl: (k) => `https://cdn.iksi.app/${k}`
	};
	let n = 0;
	const deps = { fetchImage: vi.fn(fetchImage), db, store, newId: () => `id${++n}`, dryRun };
	return { db, store, deps };
}

const p = (profileId: number, avatarUrl: string) => ({ profileId, userId: profileId, avatarUrl });

describe('mirrorAvatars', () => {
	it('skips avatars already on the CDN', async () => {
		const { deps } = setup(async () => png());
		const r = await mirrorAvatars([p(1, 'https://cdn.iksi.app/u/1/avatar/x.400.webp')], deps);
		expect(r).toEqual({ mirrored: 0, skipped: 1, failed: [] });
		expect(deps.fetchImage).not.toHaveBeenCalled();
	});

	it('mirrors a good avatar, writing objects and the row', async () => {
		const { deps, db, store } = setup(async () => png());
		const r = await mirrorAvatars([p(1, 'https://example.com/a.png')], deps);
		expect(r.mirrored).toBe(1);
		expect(store.put).toHaveBeenCalledTimes(2);
		expect(db.setAvatar).toHaveBeenCalledTimes(1);
	});

	it('records fetch failures and continues', async () => {
		const { deps } = setup(async (url) => {
			if (url.includes('bad')) throw new Error('HTTP 404');
			return png();
		});
		const r = await mirrorAvatars(
			[p(1, 'https://example.com/bad.png'), p(2, 'https://example.com/ok.png')],
			deps
		);
		expect(r.mirrored).toBe(1);
		expect(r.failed).toEqual([{ profileId: 1, reason: 'HTTP 404' }]);
	});

	it('records a non-image response as unsupported', async () => {
		const { deps, db } = setup(async () => new TextEncoder().encode('<html>nope</html>'));
		const r = await mirrorAvatars([p(1, 'https://example.com/page')], deps);
		expect(r.mirrored).toBe(0);
		expect(r.failed).toEqual([{ profileId: 1, reason: 'unsupported' }]);
		expect(db.setAvatar).not.toHaveBeenCalled();
	});

	it('dry run writes nothing but counts mirrored', async () => {
		const { deps, db, store } = setup(async () => png(), true);
		const r = await mirrorAvatars([p(1, 'https://example.com/a.png')], deps);
		expect(r.mirrored).toBe(1);
		expect(store.put).not.toHaveBeenCalled();
		expect(store.deletePrefix).not.toHaveBeenCalled();
		expect(db.setAvatar).not.toHaveBeenCalled();
	});

	it('dry run still reports unprocessable images', async () => {
		const { deps } = setup(async () => new Uint8Array([1, 2, 3]), true);
		const r = await mirrorAvatars([p(1, 'https://example.com/a.png')], deps);
		expect(r.failed).toEqual([{ profileId: 1, reason: 'unsupported' }]);
	});

	it('fetches the normalized URL', async () => {
		const { deps } = setup(async () => png());
		await mirrorAvatars([p(1, 'https://lh3.googleusercontent.com/a/abc=s96-c')], deps);
		expect(deps.fetchImage).toHaveBeenCalledWith('https://lh3.googleusercontent.com/a/abc=s400-c');
	});
});
