import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '#lib/prisma.js';
import { API_KEY_NAME_MAX, MAX_API_KEYS, type ApiKeyView } from '#lib/api-keys.js';

// Keys let the browser extension (or a script) shorten links as their owner.
// A key is "iksi_" + 32 random bytes in base64url. Only its SHA-256 is stored:
// the key has full entropy, so a fast hash is enough and lets the lookup be a
// single unique-index match on the digest.

const KEY_PREFIX = 'iksi_';
const KEY_RE = /^iksi_[A-Za-z0-9_-]{43}$/;
/** Characters of the key kept for display: "iksi_" plus 4 (24 of its 256 bits). */
const SHOWN_CHARS = KEY_PREFIX.length + 4;
/** lastUsedAt is written at most this often per key. */
const LAST_USED_RESOLUTION_MS = 60_000;

/** Shortens allowed per key per window, on top of the per-IP limit. */
export const API_KEY_RATE = { requests: 30, windowMs: 60_000 };

export class ApiKeyError extends Error {
	constructor(
		readonly code: 'name' | 'limit',
		message: string
	) {
		super(message);
	}
}

export function hashApiKey(secret: string): string {
	return createHash('sha256').update(secret).digest('hex');
}

export function isApiKeyFormat(value: string): boolean {
	return KEY_RE.test(value);
}

export function generateApiKey(): { secret: string; hash: string; prefix: string } {
	const secret = KEY_PREFIX + randomBytes(32).toString('base64url');
	return { secret, hash: hashApiKey(secret), prefix: secret.slice(0, SHOWN_CHARS) };
}

export type Bearer = { kind: 'none' } | { kind: 'key'; key: string } | { kind: 'bad' };

/**
 * Reads an Authorization header. Anything present that is not a well-formed
 * bearer key is "bad", so a broken or revoked key can never fall back to
 * anonymous shortening.
 */
export function readBearer(header: string | null): Bearer {
	if (header === null) return { kind: 'none' };
	const m = /^Bearer\s+(\S+)\s*$/i.exec(header.trim());
	if (!m || !isApiKeyFormat(m[1])) return { kind: 'bad' };
	return { kind: 'key', key: m[1] };
}

/** The owner of an active key, or null. Records the use at most once a minute. */
export async function authenticateApiKey(
	secret: string,
	now: Date = new Date()
): Promise<{ id: number; userId: number } | null> {
	if (!isApiKeyFormat(secret)) return null;
	const hash = hashApiKey(secret);
	const row = await prisma.apiKey.findUnique({
		where: { hash },
		select: { id: true, userId: true, hash: true, revokedAt: true, lastUsedAt: true }
	});
	// The index match already compared digests; this re-check does not leak timing.
	if (!row || !timingSafeEqual(Buffer.from(row.hash), Buffer.from(hash))) return null;
	if (row.revokedAt) return null;

	const cutoff = new Date(now.getTime() - LAST_USED_RESOLUTION_MS);
	if (!row.lastUsedAt || row.lastUsedAt < cutoff) {
		try {
			// Conditional, so concurrent requests write it once.
			await prisma.apiKey.updateMany({
				where: { id: row.id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: cutoff } }] },
				data: { lastUsedAt: now }
			});
		} catch (err) {
			// A missed "last used" never blocks a shorten.
			console.error('api key lastUsedAt update failed:', (err as Error).message);
		}
	}
	return { id: row.id, userId: row.userId };
}

const VIEW_SELECT = { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true } as const;

function toView(row: { id: number; name: string; prefix: string; createdAt: Date; lastUsedAt: Date | null }): ApiKeyView {
	return {
		id: row.id,
		name: row.name,
		prefix: row.prefix,
		createdAt: row.createdAt.toISOString(),
		lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null
	};
}

const activeOf = (userId: number) => ({ userId, revokedAt: null });

export async function listApiKeys(userId: number): Promise<ApiKeyView[]> {
	const rows = await prisma.apiKey.findMany({
		where: activeOf(userId),
		orderBy: { createdAt: 'desc' },
		select: VIEW_SELECT
	});
	return rows.map(toView);
}

/** Creates a key. `secret` is the only copy of the key that will ever exist outside the caller. */
export async function createApiKey(userId: number, rawName: string): Promise<{ secret: string; key: ApiKeyView }> {
	const name = typeof rawName === 'string' ? rawName.trim() : '';
	if (!name) throw new ApiKeyError('name', 'Give the key a name.');
	if (name.length > API_KEY_NAME_MAX) throw new ApiKeyError('name', `Names can be up to ${API_KEY_NAME_MAX} characters.`);

	const limit = () =>
		new ApiKeyError('limit', `You have ${MAX_API_KEYS} keys, the most you can have. Revoke one to create another.`);
	if ((await prisma.apiKey.count({ where: activeOf(userId) })) >= MAX_API_KEYS) throw limit();

	const { secret, hash, prefix } = generateApiKey();
	const row = await prisma.apiKey.create({ data: { userId, name, hash, prefix }, select: VIEW_SELECT });
	// Two creates racing past the check: the one that lands over the limit takes itself back.
	if ((await prisma.apiKey.count({ where: activeOf(userId) })) > MAX_API_KEYS) {
		await prisma.apiKey.delete({ where: { id: row.id } });
		throw limit();
	}
	return { secret, key: toView(row) };
}

/** Revokes one of the user's active keys. False when there is no such key. */
export async function revokeApiKey(userId: number, id: number, now: Date = new Date()): Promise<boolean> {
	const { count } = await prisma.apiKey.updateMany({
		where: { id, ...activeOf(userId) },
		data: { revokedAt: now }
	});
	return count === 1;
}
