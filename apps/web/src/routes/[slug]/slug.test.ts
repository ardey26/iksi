import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

const findUnique = vi.hoisted(() => vi.fn());
const recordClick = vi.hoisted(() => vi.fn());
const waitUntil = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());

vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { findUnique } } }));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL: vi.fn(async (s: string) => s) }));
vi.mock('#lib/server/tracking.js', () => ({ recordClick }));
vi.mock('@vercel/functions', () => ({ waitUntil }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit }));

import { load, actions } from './+page.server';

const HASH = bcrypt.hashSync('hunter2', 4);

const ROW = {
  id: 9,
  originalURL: 'https://example.com/',
  safeVerdict: null as string | null,
  rules: null as unknown,
  expiresAt: null as Date | null,
  expiredAt: null as Date | null,
  passwordHash: null as string | null,
  permanent: false
};

function makeEvent(path: string, init: { headers?: Record<string, string>; method?: string; body?: FormData } = {}) {
  const url = new URL(`https://www.iksi.app${path}`);
  const slug = decodeURIComponent(url.pathname.slice(1));
  return {
    url,
    params: { slug },
    request: new Request(url, { method: init.method ?? 'GET', headers: init.headers, body: init.body }),
    locals: {} as Record<string, unknown>,
    getClientAddress: () => '1.2.3.4'
  };
}

async function run(path: string, headers: Record<string, string> = {}, method = 'GET') {
  const event = makeEvent(path, { headers, method });
  try {
    const data = await load(event as never);
    return { data, event } as { data: any; event: typeof event; redirect?: undefined; error?: undefined };
  } catch (e: any) {
    if (e?.location) return { redirect: { status: e.status, location: e.location }, event } as any;
    if (typeof e?.status === 'number') return { error: { status: e.status }, event } as any;
    throw e;
  }
}

async function unlock(path: string, password: string | null) {
  const body = new FormData();
  if (password !== null) body.set('password', password);
  const event = makeEvent(path, { method: 'POST', body });
  try {
    const result: any = await actions.unlock(event as never);
    return { result, event } as any;
  } catch (e: any) {
    if (e?.location) return { redirect: { status: e.status, location: e.location }, event } as any;
    throw e;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EDGE_SECRET = 'edge';
  recordClick.mockResolvedValue(undefined);
  rateLimit.mockResolvedValue({ allowed: true });
  findUnique.mockResolvedValue({ ...ROW });
});

describe('redirect', () => {
  it('302s a plain link and records one click with the parsed surface', async () => {
    const r = await run('/AbC?s=profile&p=4&r=5');
    expect(r.redirect).toEqual({ status: 302, location: 'https://example.com/' });
    expect(recordClick).toHaveBeenCalledTimes(1);
    expect(recordClick.mock.calls[0][0]).toBe(9);
    expect(recordClick.mock.calls[0][2]).toMatchObject({ surface: 'profile', profileId: 4, rowId: 5 });
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('301s a permanent link', async () => {
    findUnique.mockResolvedValue({ ...ROW, permanent: true });
    const r = await run('/AbC');
    expect(r.redirect?.status).toBe(301);
  });

  it('does not record a click for HEAD', async () => {
    const r = await run('/AbC', {}, 'HEAD');
    expect(r.redirect?.status).toBe(302);
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('applies a country rule from trusted edge headers', async () => {
    findUnique.mockResolvedValue({
      ...ROW,
      rules: [{ id: 'abcdefgh', when: { countries: ['SG'] }, destination: 'https://sg.example.com/' }]
    });
    const r = await run('/AbC', { 'x-iksi-edge': 'edge', 'x-iksi-client-country': 'SG' });
    expect(r.redirect?.location).toBe('https://sg.example.com/');
  });

  it('uses the default destination with no UA, referer or country', async () => {
    findUnique.mockResolvedValue({
      ...ROW,
      rules: [{ id: 'abcdefgh', when: { countries: ['SG'] }, destination: 'https://sg.example.com/' }]
    });
    const r = await run('/AbC');
    expect(r.redirect?.location).toBe('https://example.com/');
  });

  it('has no in-process cache: an edited destination is used on the next load', async () => {
    findUnique.mockResolvedValueOnce({ ...ROW, originalURL: 'https://one.example.com/' });
    findUnique.mockResolvedValueOnce({ ...ROW, originalURL: 'https://two.example.com/' });
    expect((await run('/AbC')).redirect?.location).toBe('https://one.example.com/');
    expect((await run('/AbC')).redirect?.location).toBe('https://two.example.com/');
    expect(recordClick).toHaveBeenCalledTimes(2);
  });

  it('normalizes the Location so non-Latin-1 characters are percent-encoded', async () => {
    findUnique.mockResolvedValue({ ...ROW, originalURL: 'https://example.com/café/日本' });
    const r = await run('/AbC');
    expect(r.redirect?.location).toBe('https://example.com/caf%C3%A9/%E6%97%A5%E6%9C%AC');
  });

  it('404s when the destination cannot be parsed', async () => {
    findUnique.mockResolvedValue({ ...ROW, originalURL: 'not a url' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await run('/AbC');
    expect(r.error?.status).toBe(404);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('views', () => {
  it('shows flagged with 403, no click and no destination', async () => {
    findUnique.mockResolvedValue({ ...ROW, safeVerdict: 'phishing' });
    const r = await run('/AbC');
    expect(r.data).toEqual({ view: 'flagged', verdict: 'phishing' });
    expect(r.event.locals.viewStatus).toBe(403);
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('shows expired with 410 when expiresAt is past', async () => {
    findUnique.mockResolvedValue({ ...ROW, expiresAt: new Date(Date.now() - 1000) });
    const r = await run('/AbC');
    expect(r.data).toEqual({ view: 'expired' });
    expect(r.event.locals.viewStatus).toBe(410);
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('shows expired with 410 when expiredAt is set', async () => {
    findUnique.mockResolvedValue({ ...ROW, expiredAt: new Date() });
    const r = await run('/AbC');
    expect(r.data).toEqual({ view: 'expired' });
    expect(r.event.locals.viewStatus).toBe(410);
  });

  it('shows the password view for a protected link without recording a click', async () => {
    findUnique.mockResolvedValue({ ...ROW, passwordHash: HASH });
    const r = await run('/AbC');
    expect(r.data).toEqual({ view: 'password', error: null });
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('404s an unknown slug', async () => {
    findUnique.mockResolvedValue(null);
    expect((await run('/nope')).error?.status).toBe(404);
  });

  it('404s +stats without a lookup', async () => {
    expect((await run('/AbC+stats')).error?.status).toBe(404);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('preview', () => {
  it('shows host and full destination', async () => {
    findUnique.mockResolvedValue({ ...ROW, originalURL: 'https://example.com/a?b=1' });
    const r = await run('/AbC+');
    expect(r.data).toEqual({
      view: 'preview',
      host: 'example.com',
      destination: 'https://example.com/a?b=1',
      hasRules: false
    });
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('reflects rules in hasRules', async () => {
    findUnique.mockResolvedValue({
      ...ROW,
      rules: [{ id: 'abcdefgh', when: { countries: ['SG'] }, destination: 'https://sg.example.com/' }]
    });
    expect((await run('/AbC+')).data.hasRules).toBe(true);
  });

  it('never reveals a protected destination', async () => {
    findUnique.mockResolvedValue({ ...ROW, passwordHash: HASH });
    const r = await run('/AbC+');
    expect(r.data.view).toBe('preview');
    expect(r.data.destination).toBeNull();
    expect(JSON.stringify(r.data)).not.toContain('example.com');
  });

  it('404s an unknown slug', async () => {
    findUnique.mockResolvedValue(null);
    expect((await run('/nope+')).error?.status).toBe(404);
  });
});

describe('unlock', () => {
  beforeEach(() => findUnique.mockResolvedValue({ ...ROW, passwordHash: HASH }));

  it('rejects a wrong password with 400 and no destination', async () => {
    const { result } = await unlock('/AbC', 'nope');
    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: 'Wrong password' });
    expect(JSON.stringify(result)).not.toContain('example.com');
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('rejects a missing password field', async () => {
    const { result } = await unlock('/AbC', null);
    expect(result.status).toBe(400);
  });

  it('redirects 303 and records one click on the right password', async () => {
    const { redirect } = await unlock('/AbC', 'hunter2');
    expect(redirect).toEqual({ status: 303, location: 'https://example.com/' });
    expect(recordClick).toHaveBeenCalledTimes(1);
  });

  it('keys the rate limit by slug and client ip: 10 per 10 minutes', async () => {
    await unlock('/AbC', 'nope');
    expect(rateLimit).toHaveBeenCalledWith('unlock:AbC:1.2.3.4', 10, 10 * 60 * 1000);
  });

  it('429s the 11th attempt in the window without checking the password', async () => {
    let n = 0;
    rateLimit.mockImplementation(async () => ({ allowed: ++n <= 10 }));
    for (let i = 0; i < 10; i++) expect((await unlock('/AbC', 'nope')).result.status).toBe(400);
    const { result } = await unlock('/AbC', 'hunter2');
    expect(result.status).toBe(429);
    expect(result.data).toEqual({ error: 'Too many attempts. Try again in a few minutes.' });
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('sends a link that is no longer protected back to the plain route', async () => {
    findUnique.mockResolvedValue({ ...ROW, passwordHash: null });
    const { redirect } = await unlock('/AbC', 'x');
    expect(redirect).toEqual({ status: 303, location: '/AbC' });
    expect(recordClick).not.toHaveBeenCalled();
  });
});
