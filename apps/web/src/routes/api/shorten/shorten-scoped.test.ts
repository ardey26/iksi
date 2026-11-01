// Profile-scoped custom names: iksi.app/@handle/name.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const findUser = vi.hoisted(() => vi.fn());
const verifyUserSession = vi.hoisted(() => vi.fn());
const authenticateApiKey = vi.hoisted(() => vi.fn());

vi.mock('#lib/prisma.js', () => ({
  prisma: { longURL: { findFirst, create }, user: { findUnique: findUser } }
}));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession }));
vi.mock('#lib/server/crypto.js', () => ({ encodeURL: vi.fn((u: string) => `enc:${u}`) }));
vi.mock('#lib/server/link-verdict.js', () => ({ settleVerdictInBackground: vi.fn() }));
vi.mock('#lib/server/api-keys.js', async (orig) => ({
  ...(await orig<typeof import('#lib/server/api-keys.js')>()),
  authenticateApiKey
}));

import { POST } from './+server.js';

const KEY = 'iksi_' + 'k'.repeat(43);
const URL_IN = 'https://example.com/sale';

/** Names already stored. */
let taken: Set<string>;
/** What the signed-in user's account says. */
let account: { handle: string | null; scopeCustomNames: boolean } | null;

function shorten(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const request = new Request('https://www.iksi.app/api/shorten', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ longURL: URL_IN, ...body })
  });
  return POST({
    request,
    cookies: { get: (n: string) => (n === 'user_session' ? 'cookie' : undefined) },
    getClientAddress: () => '1.2.3.4'
  } as never);
}

async function call(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const res = await shorten(body, headers);
  return { status: res.status, body: await res.json() };
}

const stored = () => create.mock.calls.map(([q]) => q.data.shortURL);

beforeEach(() => {
  vi.clearAllMocks();
  taken = new Set();
  account = { handle: 'andre', scopeCustomNames: false };
  verifyUserSession.mockReturnValue(9);
  authenticateApiKey.mockResolvedValue({ id: 7, userId: 42 });
  findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
    typeof where.shortURL === 'string' && taken.has(where.shortURL) ? { id: 1 } : null
  );
  findUser.mockImplementation(async () =>
    account === null
      ? null
      : { scopeCustomNames: account.scopeCustomNames, handle: account.handle ? { handle: account.handle } : null }
  );
  create.mockImplementation(async ({ data }: { data: { shortURL: string } }) => {
    taken.add(data.shortURL);
    return { id: 1, shortURL: data.shortURL, clickCount: 0, createdAt: new Date(0), safeVerdict: null, settingsVersion: 0 };
  });
});

describe('suggestion', () => {
  it('offers @handle/name when a custom name is taken and the scoped one is free', async () => {
    taken.add('sale');
    const r = await call({ customURL: 'sale' });
    expect(r.status).toBe(409);
    expect(r.body.suggestion).toBe('@andre/sale');
    expect(create).not.toHaveBeenCalled();
  });

  it('offers @handle/name for a reserved name', async () => {
    const r = await call({ customURL: 'dashboard' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/reserved/i);
    expect(r.body.suggestion).toBe('@andre/dashboard');
  });

  it('offers nothing when the scoped name is taken too', async () => {
    taken.add('sale').add('@andre/sale');
    const r = await call({ customURL: 'sale' });
    expect(r.status).toBe(409);
    expect(r.body).not.toHaveProperty('suggestion');
  });

  it('offers nothing to a visitor who is not signed in', async () => {
    verifyUserSession.mockReturnValue(null);
    taken.add('sale');
    const r = await call({ customURL: 'sale' });
    expect(r.status).toBe(409);
    expect(r.body).not.toHaveProperty('suggestion');
    expect(findUser).not.toHaveBeenCalled();
  });

  it('offers nothing to a user without a handle', async () => {
    account = { handle: null, scopeCustomNames: false };
    taken.add('sale');
    const r = await call({ customURL: 'sale' });
    expect(r.status).toBe(409);
    expect(r.body).not.toHaveProperty('suggestion');
  });

  it('a free name is created globally as before', async () => {
    const r = await call({ customURL: 'sale' });
    expect(r.status).toBe(200);
    expect(r.body.shortURL).toBe('sale');
  });
});

describe('asking for a scoped name', () => {
  it('creates @handle/name for the handle owner', async () => {
    const r = await call({ customURL: '@andre/sale' });
    expect(r.status).toBe(200);
    expect(r.body.shortURL).toBe('@andre/sale');
    expect(r.body.link.shortURL).toBe('@andre/sale');
    expect(stored()).toEqual(['@andre/sale']);
    expect(create.mock.calls[0][0].data).toMatchObject({ userId: 9, urlHash: null });
  });

  it('reads the handle in any case and stores it lowercase', async () => {
    const r = await call({ customURL: '@AnDre/Sale' });
    expect(r.status).toBe(200);
    expect(stored()).toEqual(['@andre/Sale']);
  });

  it("refuses someone else's handle with 403", async () => {
    const r = await call({ customURL: '@bob/sale' });
    expect(r.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses a visitor who is not signed in with 403', async () => {
    verifyUserSession.mockReturnValue(null);
    const r = await call({ customURL: '@andre/sale' });
    expect(r.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('409s a scoped name that is taken, with no suggestion', async () => {
    taken.add('@andre/sale');
    const r = await call({ customURL: '@andre/sale' });
    expect(r.status).toBe(409);
    expect(r.body).not.toHaveProperty('suggestion');
  });

  it.each(['@andre/sa le', '@andre/', '@andre/a/b', '@andre/' + 'a'.repeat(51), '@andre/sale+'])(
    'refuses the malformed name %j with 400',
    async (name) => {
      const r = await call({ customURL: name });
      expect(r.status).toBe(400);
      expect(create).not.toHaveBeenCalled();
    }
  );

  it('answers a lost race for the same name with 409', async () => {
    create.mockRejectedValueOnce(
      Object.assign(new Error('unique'), { name: 'PrismaClientKnownRequestError', code: 'P2002', meta: { target: ['shortURL'] } })
    );
    const r = await call({ customURL: '@andre/sale' });
    expect(r.status).toBe(409);
  });
});

describe('"Use my handle for custom names"', () => {
  beforeEach(() => {
    account = { handle: 'andre', scopeCustomNames: true };
  });

  it('creates custom names under the handle', async () => {
    const r = await call({ customURL: 'sale' });
    expect(r.status).toBe(200);
    expect(r.body.shortURL).toBe('@andre/sale');
    expect(stored()).toEqual(['@andre/sale']);
  });

  it('allows a name that is reserved at the top level', async () => {
    const r = await call({ customURL: 'dashboard' });
    expect(r.status).toBe(200);
    expect(r.body.shortURL).toBe('@andre/dashboard');
  });

  it('409s when the scoped name is taken', async () => {
    taken.add('@andre/sale');
    const r = await call({ customURL: 'sale' });
    expect(r.status).toBe(409);
    expect(r.body).not.toHaveProperty('suggestion');
  });

  it('leaves random names global', async () => {
    const r = await call({ customURL: '' });
    expect(r.status).toBe(200);
    expect(r.body.shortURL).toMatch(/^[A-Za-z0-9]+$/);
    expect(findUser).not.toHaveBeenCalled();
  });

  it('does nothing for a user without a handle', async () => {
    account = { handle: null, scopeCustomNames: true };
    const r = await call({ customURL: 'sale' });
    expect(r.body.shortURL).toBe('sale');
  });
});

describe('API keys (browser extension)', () => {
  const auth = { authorization: `Bearer ${KEY}` };

  it("looks up the key owner's handle, not the session's", async () => {
    taken.add('sale');
    const r = await call({ customURL: 'sale' }, auth);
    expect(r.status).toBe(409);
    expect(r.body.suggestion).toBe('@andre/sale');
    expect(findUser.mock.calls[0][0].where).toEqual({ id: 42 });
    expect(verifyUserSession).not.toHaveBeenCalled();
  });

  it('auto-scopes with the setting on', async () => {
    account = { handle: 'andre', scopeCustomNames: true };
    const r = await call({ customURL: 'sale' }, auth);
    expect(r.body.shortURL).toBe('@andre/sale');
    expect(create.mock.calls[0][0].data.userId).toBe(42);
  });

  it("refuses someone else's handle with 403", async () => {
    const r = await call({ customURL: '@bob/sale' }, auth);
    expect(r.status).toBe(403);
  });
});
