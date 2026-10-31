import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { replaceMedia, removeMedia, type ProfileMediaDb } from './profile-media';
import { MediaError } from './media';
import type { MediaStore } from './media-store';

async function png() {
	return new Uint8Array(
		await sharp({ create: { width: 50, height: 50, channels: 3, background: '#f00' } }).png().toBuffer()
	);
}

function setup(row: { avatarKey: string | null; backgroundKey: string | null } = { avatarKey: null, backgroundKey: null }) {
	const calls: string[] = [];
	const puts: string[] = [];
	const deletes: string[] = [];
	const db: ProfileMediaDb = {
		current: vi.fn(async () => ({ profileId: 3, ...row })),
		setAvatar: vi.fn(async () => void calls.push('setAvatar')),
		setBackground: vi.fn(async () => void calls.push('setBackground'))
	};
	const store: MediaStore = {
		put: vi.fn(async (k: string) => void puts.push(k)),
		deletePrefix: vi.fn(async (p: string) => {
			calls.push('delete');
			deletes.push(p);
		}),
		publicUrl: (k: string) => `https://cdn.iksi.app/${k}`
	};
	return { db, store, calls, puts, deletes };
}

describe('replaceMedia', () => {
	it('first avatar upload writes variants and row, no delete', async () => {
		const s = setup();
		const r = await replaceMedia(7, 'avatar', await png(), { db: s.db, store: s.store, newId: () => 'u1' });
		expect(s.puts.sort()).toEqual(['7/avatar/u1.400.webp', '7/avatar/u1.96.webp']);
		expect(s.db.setAvatar).toHaveBeenCalledWith(3, 'https://cdn.iksi.app/7/avatar/u1.400.webp', '7/avatar/u1');
		expect(s.deletes).toEqual([]);
		expect(r.url).toBe('https://cdn.iksi.app/7/avatar/u1.400.webp');
	});

	it('second upload deletes the old prefix (trailing dot) after the db write', async () => {
		const s = setup({ avatarKey: '7/avatar/u1', backgroundKey: null });
		await replaceMedia(7, 'avatar', await png(), { db: s.db, store: s.store, newId: () => 'u2' });
		expect(s.puts.every((k) => k.startsWith('7/avatar/u2.'))).toBe(true);
		expect(s.deletes).toEqual(['7/avatar/u1.']);
		expect(s.calls).toEqual(['setAvatar', 'delete']);
	});

	it('background uses the 1600 variant and setBackground', async () => {
		const s = setup();
		const r = await replaceMedia(7, 'background', await png(), { db: s.db, store: s.store, newId: () => 'b1' });
		expect(r.url).toBe('https://cdn.iksi.app/7/background/b1.1600.webp');
		expect(s.db.setBackground).toHaveBeenCalledWith(3, r.url, '7/background/b1');
	});

	it('a failing delete does not reject', async () => {
		const s = setup({ avatarKey: '7/avatar/u1', backgroundKey: null });
		(s.store.deletePrefix as any).mockRejectedValue(new Error('boom'));
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		await expect(
			replaceMedia(7, 'avatar', await png(), { db: s.db, store: s.store, newId: () => 'u2' })
		).resolves.toHaveProperty('url');
		err.mockRestore();
	});

	it('MediaError rejects with nothing written or deleted', async () => {
		const s = setup({ avatarKey: '7/avatar/u1', backgroundKey: null });
		await expect(
			replaceMedia(7, 'avatar', new TextEncoder().encode('hello world'), { db: s.db, store: s.store, newId: () => 'u2' })
		).rejects.toBeInstanceOf(MediaError);
		expect(s.puts).toEqual([]);
		expect(s.deletes).toEqual([]);
		expect(s.db.setAvatar).not.toHaveBeenCalled();
	});
});

describe('key ownership', () => {
	it('every key and prefix starts with the uploading userId', async () => {
		const a = setup({ avatarKey: '7/avatar/u1', backgroundKey: null });
		await replaceMedia(7, 'avatar', await png(), { db: a.db, store: a.store, newId: () => 'u2' });
		const b = setup({ avatarKey: null, backgroundKey: '42/background/b1' });
		await replaceMedia(42, 'background', await png(), { db: b.db, store: b.store, newId: () => 'b2' });

		expect(a.puts.length).toBeGreaterThan(0);
		expect(b.puts.length).toBeGreaterThan(0);
		for (const k of [...a.puts, ...a.deletes]) expect(k.startsWith('7/')).toBe(true);
		for (const k of [...b.puts, ...b.deletes]) {
			expect(k.startsWith('42/')).toBe(true);
			expect(k.startsWith('7/')).toBe(false);
		}
		expect(b.deletes).toEqual(['42/background/b1.']);
	});
});

describe('removeMedia', () => {
	it('clears the row then deletes the old prefix', async () => {
		const s = setup({ avatarKey: null, backgroundKey: '7/background/b1' });
		await removeMedia(7, 'background', { db: s.db, store: s.store });
		expect(s.db.setBackground).toHaveBeenCalledWith(3, null, null);
		expect(s.deletes).toEqual(['7/background/b1.']);
		expect(s.calls).toEqual(['setBackground', 'delete']);
	});

	it('no key means no delete', async () => {
		const s = setup();
		await removeMedia(7, 'avatar', { db: s.db, store: s.store });
		expect(s.deletes).toEqual([]);
	});
});
