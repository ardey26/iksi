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
  const json = JSON.stringify(body);
  const request = new Request('https://www.iksi.app/api/shorten', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(json)) },
    body: json
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
    ['an owner', { userId: 42 }],
    ['a one-time mark', { oneTime: true }]
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

  it.each(['malware', 'phishing', 'unwanted'])(
    'a new slug for a URL already flagged %s starts flagged instead of redirecting until checked',
    async (safeVerdict) => {
      withHashRow({ ...EXISTING, safeVerdict });
      await shorten();
      expect(create.mock.calls[0][0].data.safeVerdict).toBe(safeVerdict);
    }
  );

  it('a new slug made only because of settings carries no verdict', async () => {
    withHashRow({ ...EXISTING, passwordHash: '$2b$10$x' });
    await shorten();
    expect(create.mock.calls[0][0].data.safeVerdict ?? null).toBeNull();
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

describe('reserved custom names', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(null);
    create.mockImplementation(async ({ data }: { data: { shortURL: string } }) => ({ shortURL: data.shortURL, settingsVersion: 0 }));
  });

  it.each(['dashboard', 'api', 'login', 'logout', 'auth', 'admin', 'internal', '_app', 'report', 'privacy'])(
    'refuses %s because the app owns that path',
    async (name) => {
      const r = await shorten({ longURL: URL_IN, customURL: name });
      expect(r.status).toBe(400);
      expect((await r.json()).error).toMatch(/reserved/i);
      expect(create).not.toHaveBeenCalled();
    }
  );

  it('still allows media, which only reserves paths below it', async () => {
    const r = await shorten({ longURL: URL_IN, customURL: 'media' });
    expect(r.status).toBe(200);
  });
});

describe('one-time links', () => {
  const TEXT = 'wifi password is hunter2';
  const oneTime = (o: Record<string, unknown>) => shorten({ oneTime: o });

  beforeEach(() => withHashRow({ ...EXISTING }));

  it('stores a text secret encrypted in secret, never in originalURL, and never dedupes', async () => {
    const before = Date.now();
    const res = await oneTime({ kind: 'text', content: TEXT });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      oneTime: true,
      secretKind: 'text',
      secret: `enc:${TEXT}`,
      originalURL: '',
      urlHash: null,
      userId: null,
      passwordHash: null
    });
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(body.shortURL).toMatch(/^[A-Za-z0-9]{10}$/);
    // Seven days, give or take the test's own run time.
    const ttl = data.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(7 * 86400000);
    expect(ttl).toBeLessThan(7 * 86400000 + 5000);
    // No hash lookup at all: a one-time link is never handed out twice.
    expect(findFirst.mock.calls.some(([q]) => 'urlHash' in q.where)).toBe(false);
    expect(settleVerdictInBackground).not.toHaveBeenCalled();
  });

  it('a URL secret gets a new slug even when a plain link for the same URL exists', async () => {
    const res = await oneTime({ kind: 'url', content: URL_IN });
    const body = await res.json();
    expect(body.shortURL).not.toBe('Old1234');
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ oneTime: true, secretKind: 'url', secret: `enc:${URL_IN}`, originalURL: '', urlHash: null });
    expect(findFirst.mock.calls.some(([q]) => 'urlHash' in q.where)).toBe(false);
    // The URL is still checked so a flagged destination is never revealed.
    expect(settleVerdictInBackground).toHaveBeenCalledWith(body.shortURL, [URL_IN], 0);
  });

  it('a later plain shorten of the same URL never gets the one-time link', async () => {
    withHashRow({ ...EXISTING, oneTime: true });
    const res = await shorten();
    expect((await res.json()).shortURL).not.toBe('Old1234');
    expect(findFirst.mock.calls.find(([q]) => 'urlHash' in q.where)[0].select).toMatchObject({ oneTime: true });
  });

  it('belongs to the signed-in user', async () => {
    verifyUserSession.mockReturnValue(42);
    await oneTime({ kind: 'text', content: TEXT });
    expect(create.mock.calls[0][0].data.userId).toBe(42);
  });

  it('hashes an optional password', async () => {
    await oneTime({ kind: 'text', content: TEXT, password: 'open sesame' });
    const { passwordHash } = create.mock.calls[0][0].data;
    expect(passwordHash).toMatch(/^\$2[aby]\$10\$/);
    const bcrypt = (await import('bcrypt')).default;
    expect(await bcrypt.compare('open sesame', passwordHash)).toBe(true);
  });

  it('returns the dashboard row without the content', async () => {
    const body = await (await oneTime({ kind: 'url', content: URL_IN })).json();
    expect(body.link).toMatchObject({ oneTime: { kind: 'url', state: 'unopened' }, originalURL: '' });
    expect(JSON.stringify(body.link)).not.toContain('example.com');
  });

  it('accepts a full 2,000 character text in a multibyte script', async () => {
    const res = await oneTime({ kind: 'text', content: '日'.repeat(2000) });
    expect(res.status).toBe(200);
  });

  it.each([
    ['Text is too long (max 2,000 characters)', { kind: 'text', content: 'a'.repeat(2001) }],
    ['Enter the text to share', { kind: 'text', content: '   ' }],
    ['Enter a valid URL', { kind: 'url', content: 'nope' }],
    ['Password must be 4 to 128 characters', { kind: 'text', content: 'x', password: 'abc' }],
    ['Choose a URL or a text', { kind: 'zip', content: 'x' }]
  ])('rejects with "%s"', async (error, input) => {
    const res = await oneTime(input);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(error);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses a custom name: one-time links get a long random one', async () => {
    const res = await shorten({ oneTime: { kind: 'text', content: TEXT }, customURL: 'mine' });
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('still refuses an oversized body', async () => {
    const res = await oneTime({ kind: 'text', content: 'a'.repeat(20000) });
    expect(res.status).toBe(413);
  });
});
