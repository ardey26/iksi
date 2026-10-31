// Orchestrates avatar/background replacement: write new objects, then the
// database row, then delete the old objects. Keys derive only from the
// session user id passed in, never from request input.
import { processImage, mediaBaseKey, variantKey, type MediaKind } from './media';
import type { MediaStore } from './media-store';

export interface ProfileMediaDb {
	current(userId: number): Promise<{ profileId: number; avatarKey: string | null; backgroundKey: string | null } | null>;
	setAvatar(profileId: number, url: string | null, key: string | null): Promise<void>;
	setBackground(profileId: number, url: string | null, key: string | null): Promise<void>;
}

export class NoProfileError extends Error {
	constructor() {
		super('No profile');
		this.name = 'NoProfileError';
	}
}

export function prismaProfileMediaDb(): ProfileMediaDb {
	const prisma = async () => (await import('#lib/prisma.js')).prisma;
	return {
		async current(userId) {
			const p = await (await prisma()).profile.findUnique({ where: { userId } });
			return p ? { profileId: p.id, avatarKey: p.avatarKey, backgroundKey: p.backgroundKey } : null;
		},
		async setAvatar(profileId, url, key) {
			await (await prisma()).profile.update({ where: { id: profileId }, data: { avatarUrl: url, avatarKey: key } });
		},
		async setBackground(profileId, url, key) {
			await (await prisma()).profile.update({
				where: { id: profileId },
				data: { backgroundUrl: url, backgroundKey: key }
			});
		}
	};
}

// Trailing dot so one upload's prefix can never match another id sharing leading characters.
export async function deleteMediaQuietly(store: MediaStore, baseKey: string | null): Promise<void> {
	if (!baseKey) return;
	try {
		await store.deletePrefix(baseKey + '.');
	} catch (err) {
		console.error('Failed to delete old media', baseKey, err);
	}
}

export async function replaceMedia(
	userId: number,
	kind: MediaKind,
	input: Uint8Array,
	deps: { db: ProfileMediaDb; store: MediaStore; newId: () => string }
): Promise<{ url: string }> {
	const { db, store } = deps;
	const cur = await db.current(userId);
	if (!cur) throw new NoProfileError();

	const variants = await processImage(input, kind);
	const base = mediaBaseKey(userId, kind, deps.newId());
	for (const v of variants) await store.put(variantKey(base, v.name), v.bytes, 'image/webp');

	const url = store.publicUrl(variantKey(base, variants[0].name));
	const oldKey = kind === 'avatar' ? cur.avatarKey : cur.backgroundKey;
	if (kind === 'avatar') await db.setAvatar(cur.profileId, url, base);
	else await db.setBackground(cur.profileId, url, base);

	await deleteMediaQuietly(store, oldKey);
	return { url };
}

export async function removeMedia(
	userId: number,
	kind: MediaKind,
	deps: { db: ProfileMediaDb; store: MediaStore }
): Promise<void> {
	const cur = await deps.db.current(userId);
	if (!cur) throw new NoProfileError();
	const oldKey = kind === 'avatar' ? cur.avatarKey : cur.backgroundKey;
	if (kind === 'avatar') await deps.db.setAvatar(cur.profileId, null, null);
	else await deps.db.setBackground(cur.profileId, null, null);
	await deleteMediaQuietly(deps.store, oldKey);
}
