import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

const apiKey = vi.hoisted(() => ({
	findUnique: vi.fn(),
	findMany: vi.fn(),
	count: vi.fn(),
	create: vi.fn(),
	delete: vi.fn(),
	updateMany: vi.fn()
}));
vi.mock('#lib/prisma.js', () => ({ prisma: { apiKey } }));

import {
	ApiKeyError,
	authenticateApiKey,
	createApiKey,
	generateApiKey,
	hashApiKey,
	isApiKeyFormat,
	listApiKeys,
	readBearer,
	revokeApiKey
} from './api-keys.js';
import { MAX_API_KEYS } from '#lib/api-keys.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const KEY = 'iksi_' + 'A'.repeat(43);

beforeEach(() => {
	vi.clearAllMocks();
	apiKey.updateMany.mockResolvedValue({ count: 1 });
});

describe('generateApiKey', () => {
	it('makes a prefixed key from 32 random bytes, and stores only its SHA-256', () => {
		const { secret, hash, prefix } = generateApiKey();
		expect(secret).toMatch(/^iksi_[A-Za-z0-9_-]{43}$/);
		expect(hash).toBe(sha(secret));
		expect(prefix).toBe(secret.slice(0, 9));
		expect(hash).not.toContain(secret.slice(5));
	});

	it('never repeats', () => {
		const seen = new Set(Array.from({ length: 50 }, () => generateApiKey().secret));
		expect(seen.size).toBe(50);
	});
});

describe('isApiKeyFormat', () => {
	it.each([
		[KEY, true],
		['iksi_' + 'A'.repeat(42), false],
		['iksi_' + 'A'.repeat(44), false],
		['iksx_' + 'A'.repeat(43), false],
		['iksi_' + 'A'.repeat(42) + '=', false],
		['', false]
	])('%s → %s', (k, ok) => expect(isApiKeyFormat(k)).toBe(ok));
});

describe('readBearer', () => {
	it('is none without an Authorization header', () => {
		expect(readBearer(null)).toEqual({ kind: 'none' });
	});
	it('reads a bearer key, any case scheme', () => {
		expect(readBearer(`Bearer ${KEY}`)).toEqual({ kind: 'key', key: KEY });
		expect(readBearer(`bearer  ${KEY} `)).toEqual({ kind: 'key', key: KEY });
	});
	it.each(['', 'Bearer', 'Bearer ', `Basic ${KEY}`, 'Bearer not-a-key', `Bearer ${KEY} extra`])(
		'treats %j as a bad key, never as no key',
		(h) => expect(readBearer(h)).toEqual({ kind: 'bad' })
	);
});

describe('authenticateApiKey', () => {
	const row = (over = {}) => ({
		id: 7,
		userId: 42,
		hash: sha(KEY),
		revokedAt: null,
		lastUsedAt: new Date(Date.now() - 120_000),
		...over
	});

	it('looks the key up by its hash and returns its owner', async () => {
		apiKey.findUnique.mockResolvedValue(row());
		expect(await authenticateApiKey(KEY)).toEqual({ id: 7, userId: 42 });
		expect(apiKey.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { hash: sha(KEY) } }));
	});

	it('rejects an unknown key', async () => {
		apiKey.findUnique.mockResolvedValue(null);
		expect(await authenticateApiKey(KEY)).toBeNull();
	});

	it('rejects a revoked key', async () => {
		apiKey.findUnique.mockResolvedValue(row({ revokedAt: new Date() }));
		expect(await authenticateApiKey(KEY)).toBeNull();
		expect(apiKey.updateMany).not.toHaveBeenCalled();
	});

	it('rejects a malformed key without a lookup', async () => {
		expect(await authenticateApiKey('iksi_short')).toBeNull();
		expect(apiKey.findUnique).not.toHaveBeenCalled();
	});

	it('records use when the last one was over a minute ago, guarded against races', async () => {
		const now = new Date('2026-11-01T10:00:00Z');
		apiKey.findUnique.mockResolvedValue(row({ lastUsedAt: new Date(now.getTime() - 120_000) }));
		await authenticateApiKey(KEY, now);
		expect(apiKey.updateMany).toHaveBeenCalledWith({
			where: { id: 7, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now.getTime() - 60_000) } }] },
			data: { lastUsedAt: now }
		});
	});

	it('records a first use', async () => {
		apiKey.findUnique.mockResolvedValue(row({ lastUsedAt: null }));
		await authenticateApiKey(KEY);
		expect(apiKey.updateMany).toHaveBeenCalledTimes(1);
	});

	it('skips the write when it was used within the minute', async () => {
		apiKey.findUnique.mockResolvedValue(row({ lastUsedAt: new Date(Date.now() - 5_000) }));
		expect(await authenticateApiKey(KEY)).toEqual({ id: 7, userId: 42 });
		expect(apiKey.updateMany).not.toHaveBeenCalled();
	});

	it('still authenticates when recording use fails', async () => {
		apiKey.findUnique.mockResolvedValue(row());
		apiKey.updateMany.mockRejectedValue(new Error('db down'));
		expect(await authenticateApiKey(KEY)).toEqual({ id: 7, userId: 42 });
	});
});

describe('createApiKey', () => {
	beforeEach(() => {
		apiKey.count.mockResolvedValue(0);
		apiKey.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
			id: 1,
			createdAt: new Date('2026-11-01T00:00:00Z'),
			lastUsedAt: null,
			...data
		}));
	});

	it('stores the hash and prefix, and returns the key once', async () => {
		const { secret, key } = await createApiKey(42, '  Chrome on laptop ');
		const data = apiKey.create.mock.calls[0][0].data;
		expect(data).toEqual({ userId: 42, name: 'Chrome on laptop', hash: sha(secret), prefix: secret.slice(0, 9) });
		expect(JSON.stringify(data)).not.toContain(secret);
		expect(key).toEqual({
			id: 1,
			name: 'Chrome on laptop',
			prefix: secret.slice(0, 9),
			createdAt: '2026-11-01T00:00:00.000Z',
			lastUsedAt: null
		});
		expect(JSON.stringify(key)).not.toContain(secret);
	});

	it.each(['', '   ', 'x'.repeat(41)])('refuses the name %j', async (name) => {
		await expect(createApiKey(42, name)).rejects.toMatchObject({ code: 'name' });
		expect(apiKey.create).not.toHaveBeenCalled();
	});

	it('refuses a non-string name', async () => {
		await expect(createApiKey(42, 5 as unknown as string)).rejects.toBeInstanceOf(ApiKeyError);
	});

	it(`refuses an eleventh active key`, async () => {
		apiKey.count.mockResolvedValue(MAX_API_KEYS);
		await expect(createApiKey(42, 'one more')).rejects.toMatchObject({ code: 'limit' });
		expect(apiKey.count).toHaveBeenCalledWith({ where: { userId: 42, revokedAt: null } });
		expect(apiKey.create).not.toHaveBeenCalled();
	});

	it('takes back a key that a concurrent create pushed over the limit', async () => {
		apiKey.count.mockResolvedValueOnce(MAX_API_KEYS - 1).mockResolvedValueOnce(MAX_API_KEYS + 1);
		await expect(createApiKey(42, 'racer')).rejects.toMatchObject({ code: 'limit' });
		expect(apiKey.delete).toHaveBeenCalledWith({ where: { id: 1 } });
	});
});

describe('listApiKeys', () => {
	it("lists the user's active keys, newest first, without hashes", async () => {
		apiKey.findMany.mockResolvedValue([
			{ id: 2, name: 'b', prefix: 'iksi_bbbb', createdAt: new Date(2000), lastUsedAt: new Date(3000) }
		]);
		expect(await listApiKeys(42)).toEqual([
			{ id: 2, name: 'b', prefix: 'iksi_bbbb', createdAt: new Date(2000).toISOString(), lastUsedAt: new Date(3000).toISOString() }
		]);
		const q = apiKey.findMany.mock.calls[0][0];
		expect(q.where).toEqual({ userId: 42, revokedAt: null });
		expect(q.orderBy).toEqual({ createdAt: 'desc' });
		expect(q.select.hash).toBeUndefined();
	});
});

describe('revokeApiKey', () => {
	it("revokes only the user's own active key", async () => {
		const now = new Date();
		expect(await revokeApiKey(42, 7, now)).toBe(true);
		expect(apiKey.updateMany).toHaveBeenCalledWith({
			where: { id: 7, userId: 42, revokedAt: null },
			data: { revokedAt: now }
		});
	});

	it("reports a key that is not the user's, or already revoked", async () => {
		apiKey.updateMany.mockResolvedValue({ count: 0 });
		expect(await revokeApiKey(42, 7)).toBe(false);
	});
});
