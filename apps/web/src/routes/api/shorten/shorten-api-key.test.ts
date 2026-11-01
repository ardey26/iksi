import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const verifyUserSession = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const authenticateApiKey = vi.hoisted(() => vi.fn());

vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { findFirst, create } } }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit }));
vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession }));
vi.mock('#lib/server/crypto.js', () => ({ encodeURL: vi.fn((u: string) => `enc:${u}`) }));
vi.mock('#lib/server/link-verdict.js', () => ({ settleVerdictInBackground: vi.fn() }));
vi.mock('#lib/server/api-keys.js', async (orig) => ({
  ...(await orig<typeof import('#lib/server/api-keys.js')>()),
  authenticateApiKey
}));

import { POST, OPTIONS } from './+server.js';
import { API_KEY_RATE } from '#lib/server/api-keys.js';

const KEY = 'iksi_' + 'k'.repeat(43);
const EXT = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

function shorten(headers: Record<string, string> = {}, body: unknown = { longURL: 'https://example.com/a' }) {
  const request = new Request('https://www.iksi.app/api/shorten', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  return POST({
    request,
    cookies: { get: (n: string) => (n === 'user_session' ? 'session-cookie' : undefined) },
    getClientAddress: () => '1.2.3.4'
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ allowed: true });
  verifyUserSession.mockReturnValue(9);
  findFirst.mockResolvedValue(null);
  authenticateApiKey.mockResolvedValue({ id: 7, userId: 42 });
  create.mockImplementation(async ({ data }: { data: { shortURL: string } }) => ({
    id: 1,
    shortURL: data.shortURL,
    clickCount: 0,
    createdAt: new Date(0),
    safeVerdict: null,
    settingsVersion: 0
  }));
});

describe('API key auth', () => {
  it("shortens as the key's owner, ignoring any session cookie", async () => {
    const res = await shorten({ authorization: `Bearer ${KEY}` });
    expect(res.status).toBe(200);
    expect(authenticateApiKey).toHaveBeenCalledWith(KEY);
    expect(create.mock.calls[0][0].data.userId).toBe(42);
    expect(verifyUserSession).not.toHaveBeenCalled();
  });

  it('dedupes against the key owner, not the anonymous pool', async () => {
    await shorten({ authorization: `Bearer ${KEY}` });
    expect(findFirst.mock.calls.some(([q]) => q.where.userId === 42 && 'urlHash' in q.where)).toBe(true);
  });

  it('refuses an unknown or revoked key with 401 and never shortens anonymously', async () => {
    authenticateApiKey.mockResolvedValue(null);
    const res = await shorten({ authorization: `Bearer ${KEY}` });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('invalid_key');
    expect(create).not.toHaveBeenCalled();
  });

  it.each(['Bearer nope', 'Basic abc', '', `Token ${KEY}`])('refuses the header %j with 401', async (h) => {
    const res = await shorten({ authorization: h });
    expect(res.status).toBe(401);
    expect(authenticateApiKey).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('applies the per-IP limit before looking the key up', async () => {
    rateLimit.mockResolvedValueOnce({ allowed: false });
    const res = await shorten({ authorization: `Bearer ${KEY}` });
    expect(res.status).toBe(429);
    expect(authenticateApiKey).not.toHaveBeenCalled();
  });

  it('limits each key on its own', async () => {
    await shorten({ authorization: `Bearer ${KEY}` });
    expect(rateLimit).toHaveBeenCalledWith('apikey:7', API_KEY_RATE.requests, API_KEY_RATE.windowMs);
  });

  it('answers 429 when the key is over its limit', async () => {
    rateLimit.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false });
    const res = await shorten({ authorization: `Bearer ${KEY}` });
    expect(res.status).toBe(429);
    expect(create).not.toHaveBeenCalled();
  });

  it('leaves session shortening as it was', async () => {
    const res = await shorten();
    expect(res.status).toBe(200);
    expect(authenticateApiKey).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data.userId).toBe(9);
    expect(rateLimit).toHaveBeenCalledTimes(1);
  });
});

describe('browser extension origins', () => {
  it.each([EXT, 'moz-extension://0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4'])('lets %s read the response', async (origin) => {
    const res = await shorten({ authorization: `Bearer ${KEY}`, origin });
    expect(res.headers.get('access-control-allow-origin')).toBe(origin);
    expect(res.headers.get('vary')).toMatch(/origin/i);
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('also on errors, so the extension can show them', async () => {
    authenticateApiKey.mockResolvedValue(null);
    const res = await shorten({ authorization: `Bearer ${KEY}`, origin: EXT });
    expect(res.status).toBe(401);
    expect(res.headers.get('access-control-allow-origin')).toBe(EXT);
  });

  it.each(['https://evil.example', 'null'])('does not open the response to %s', async (origin) => {
    const res = await shorten({ authorization: `Bearer ${KEY}`, origin });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers an extension preflight for a keyed JSON POST', async () => {
    const res = await OPTIONS({
      request: new Request('https://www.iksi.app/api/shorten', {
        method: 'OPTIONS',
        headers: {
          origin: EXT,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization, content-type'
        }
      })
    } as never);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(EXT);
    expect(res.headers.get('access-control-allow-methods')).toBe('POST');
    expect(res.headers.get('access-control-allow-headers')).toMatch(/authorization/i);
    expect(res.headers.get('access-control-allow-headers')).toMatch(/content-type/i);
  });

  it('gives other origins no CORS grant on preflight', async () => {
    const res = await OPTIONS({
      request: new Request('https://www.iksi.app/api/shorten', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' }
      })
    } as never);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
