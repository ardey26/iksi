import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const verifyUserSession = vi.hoisted(() => vi.fn());
const settleVerdictInBackground = vi.hoisted(() => vi.fn());

vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { findFirst, create } } }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession }));
vi.mock('#lib/server/crypto.js', () => ({ encodeURL: vi.fn((u: string) => `enc:${u}`) }));
vi.mock('#lib/server/link-verdict.js', () => ({ settleVerdictInBackground }));

import { POST } from './+server.js';

const URL_IN = 'https://example.com/page';

/** The row an earlier anonymous shorten of URL_IN left behind. */
const EXISTING = {
  shortURL: 'Old1234',
  userId: null as number | null,
  rules: null as unknown,
  passwordHash: null as string | null,
  expiresAt: null as Date | null,
  maxClicks: null as number | null,
  expiredAt: null as Date | null,
  permanent: false,
  safeVerdict: 'safe' as string | null
};

function shorten(body: unknown = { longURL: URL_IN }) {
  const request = new Request('https://www.iksi.app/api/shorten', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return POST({ request, cookies: { get: () => undefined }, getClientAddress: () => '1.2.3.4' } as never);
}

/** The hash lookup returns `hashRow`; every slug-collision lookup finds nothing. */
function withHashRow(hashRow: unknown) {
  findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
    'urlHash' in where ? hashRow : null
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyUserSession.mockReturnValue(null);
  create.mockImplementation(async ({ data }: { data: { shortURL: string } }) => ({
    id: 1,
    shortURL: data.shortURL,
    clickCount: 0,
    createdAt: new Date(0),
    safeVerdict: null,
    settingsVersion: 0
  }));
});

describe('anonymous dedupe', () => {
  it('reuses a plain anonymous link for the same URL', async () => {
    withHashRow({ ...EXISTING });
    const res = await shorten();
    expect((await res.json()).shortURL).toBe('Old1234');
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ['a password', { passwordHash: '$2b$10$x' }],
    ['rules', { rules: [{ id: 'rule0001', when: {}, destination: 'https://other.example/' }] }],
    ['an expiry date', { expiresAt: new Date(Date.now() + 60_000) }],
    ['a click cap', { maxClicks: 10 }],
    ['an expired mark', { expiredAt: new Date() }],
    ['a permanent redirect', { permanent: true }],
    ['a flagged verdict', { safeVerdict: 'phishing' }],
    ['an owner', { userId: 42 }]
  ])('returns a NEW slug when the existing row has %s', async (_n, over) => {
    withHashRow({ ...EXISTING, ...over });
    const res = await shorten();
    const body = await res.json();
    expect(body.shortURL).not.toBe('Old1234');
    expect(create).toHaveBeenCalledTimes(1);
    // The hash stays with the existing row (it is unique), so the new one stores none.
    expect(create.mock.calls[0][0].data.urlHash).toBeNull();
    expect(settleVerdictInBackground).toHaveBeenCalledWith(body.shortURL, [URL_IN], 0);
    expect(create.mock.calls[0][0].select).toMatchObject({ settingsVersion: true });
  });

  it('stores the hash on a first anonymous shorten', async () => {
    withHashRow(null);
    await shorten();
    expect(create.mock.calls[0][0].data.urlHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a lost insert race reuses the winner only when it is plain', async () => {
    let calls = 0;
    findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (!('urlHash' in where)) return null;
      calls++;
      return calls === 1 ? null : { ...EXISTING, passwordHash: '$2b$10$x' };
    });
    create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['urlHash'] } }));
    const res = await shorten();
    expect(res.status).toBe(200);
    expect((await res.json()).shortURL).not.toBe('Old1234');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].data.urlHash).toBeNull();
  });

  it('a lost insert race returns a plain winner', async () => {
    let calls = 0;
    findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (!('urlHash' in where)) return null;
      calls++;
      return calls === 1 ? null : { ...EXISTING };
    });
    create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['urlHash'] } }));
    const res = await shorten();
    expect((await res.json()).shortURL).toBe('Old1234');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
