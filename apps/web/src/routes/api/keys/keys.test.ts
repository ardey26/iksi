import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyUserSession = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const createApiKey = vi.hoisted(() => vi.fn());
const listApiKeys = vi.hoisted(() => vi.fn());
const revokeApiKey = vi.hoisted(() => vi.fn());

vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit }));
vi.mock('#lib/server/api-keys.js', async (orig) => ({
	...(await orig<typeof import('#lib/server/api-keys.js')>()),
	createApiKey,
	listApiKeys,
	revokeApiKey
}));
vi.mock('#lib/prisma.js', () => ({ prisma: {} }));

import { POST, DELETE } from './+server.js';
import { ApiKeyError } from '#lib/server/api-keys.js';

const VIEW = { id: 7, name: 'Laptop', prefix: 'iksi_ab12', createdAt: '2026-11-01T00:00:00.000Z', lastUsedAt: null };
const SECRET = 'iksi_' + 'a'.repeat(43);

const cookies = { get: (n: string) => (n === 'user_session' ? 'cookie' : undefined) };
const post = (body: unknown) =>
	POST({
		request: new Request('https://www.iksi.app/api/keys', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		cookies
	} as never);
const del = (id: string) =>
	DELETE({
		request: new Request(`https://www.iksi.app/api/keys?id=${id}`, { method: 'DELETE' }),
		url: new URL(`https://www.iksi.app/api/keys?id=${id}`),
		cookies
	} as never);

beforeEach(() => {
	vi.clearAllMocks();
	verifyUserSession.mockReturnValue(42);
	rateLimit.mockResolvedValue({ allowed: true });
	createApiKey.mockResolvedValue({ secret: SECRET, key: VIEW });
	listApiKeys.mockResolvedValue([VIEW]);
	revokeApiKey.mockResolvedValue(true);
});

describe('POST /api/keys', () => {
	it('needs a signed-in session', async () => {
		verifyUserSession.mockReturnValue(null);
		const res = await post({ name: 'Laptop' });
		expect(res.status).toBe(401);
		expect(createApiKey).not.toHaveBeenCalled();
	});

	it('creates a key and returns it this once, uncached', async () => {
		const res = await post({ name: 'Laptop' });
		expect(res.status).toBe(201);
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(await res.json()).toEqual({ secret: SECRET, keys: [VIEW] });
		expect(createApiKey).toHaveBeenCalledWith(42, 'Laptop');
	});

	it('says why a name was refused', async () => {
		createApiKey.mockRejectedValue(new ApiKeyError('name', 'Give the key a name.'));
		const res = await post({ name: '' });
		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe('Give the key a name.');
	});

	it('refuses past the key limit with 409', async () => {
		createApiKey.mockRejectedValue(new ApiKeyError('limit', 'You have 10 keys.'));
		const res = await post({ name: 'x' });
		expect(res.status).toBe(409);
		expect((await res.json()).code).toBe('limit');
	});

	it('limits how fast keys can be made', async () => {
		rateLimit.mockResolvedValue({ allowed: false });
		const res = await post({ name: 'x' });
		expect(res.status).toBe(429);
		expect(rateLimit).toHaveBeenCalledWith('api-keys:42', expect.any(Number), expect.any(Number));
		expect(createApiKey).not.toHaveBeenCalled();
	});

	it('refuses a body that is not JSON', async () => {
		const res = await POST({
			request: new Request('https://www.iksi.app/api/keys', { method: 'POST', body: 'nope' }),
			cookies
		} as never);
		expect(res.status).toBe(400);
	});
});

describe('DELETE /api/keys', () => {
	it('needs a signed-in session', async () => {
		verifyUserSession.mockReturnValue(null);
		expect((await del('7')).status).toBe(401);
		expect(revokeApiKey).not.toHaveBeenCalled();
	});

	it("revokes the user's key and returns what is left", async () => {
		listApiKeys.mockResolvedValue([]);
		const res = await del('7');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ keys: [] });
		expect(revokeApiKey).toHaveBeenCalledWith(42, 7);
	});

	it('404s a key that is not theirs or already revoked', async () => {
		revokeApiKey.mockResolvedValue(false);
		expect((await del('7')).status).toBe(404);
	});

	it.each(['', 'abc', '1.5', '-3'])('refuses the id %j', async (id) => {
		expect((await del(id)).status).toBe(400);
		expect(revokeApiKey).not.toHaveBeenCalled();
	});
});
