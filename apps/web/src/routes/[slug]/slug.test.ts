import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

const findUnique = vi.hoisted(() => vi.fn());
const recordClick = vi.hoisted(() => vi.fn());
const waitUntil = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const executeRaw = vi.hoisted(() => vi.fn());

vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { findUnique }, $executeRaw: executeRaw } }));
// Ciphertext is modelled as an `enc:` prefix; anything else decodes to itself, as a legacy plain value does.
vi.mock('#lib/server/crypto.js', () => ({
  decodeURL: vi.fn(async (s: string) => (s.startsWith('enc:') ? s.slice(4) : s))
}));
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
  permanent: false,
  clickCount: 0,
  maxClicks: null as number | null,
  oneTime: false,
  secretKind: null as string | null,
  openedAt: null as Date | null
};

function makeEvent(path: string, init: { headers?: Record<string, string>; method?: string; body?: FormData } = {}) {
  const url = new URL(`https://www.iksi.app${path}`);
  const slug = decodeURIComponent(url.pathname.slice(1));
  const headers: Record<string, string> = {};
  return {
    url,
    params: { slug },
    headers,
    // Mirrors SvelteKit: a header may be set once per response.
    setHeaders: (h: Record<string, string>) => {
      for (const [k, v] of Object.entries(h)) {
        if (k.toLowerCase() in headers) throw new Error(`header ${k} already set`);
        headers[k.toLowerCase()] = v;
      }
    },
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
    if (typeof e?.status === 'number') return { error: { status: e.status, body: e.body }, event } as any;
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

  it('still redirects a link named media (images live under /media/<key>)', async () => {
    const r = await run('/media');
    expect(r.redirect).toEqual({ status: 302, location: 'https://example.com/' });
  });

  it('301s a permanent link', async () => {
    findUnique.mockResolvedValue({ ...ROW, permanent: true });
    const r = await run('/AbC');
    expect(r.redirect?.status).toBe(301);
  });

  it('does not record a click for a data request (hover preload)', async () => {
    const event: any = makeEvent('/AbC');
    event.isDataRequest = true;
    await expect(load(event)).rejects.toMatchObject({ status: 302 });
    expect(recordClick).not.toHaveBeenCalled();
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

describe('cache-control', () => {
  it('marks the origin redirect private, no-store so a browser never keeps it', async () => {
    const r = await run('/AbC');
    expect(r.redirect?.status).toBe(302);
    expect(r.event.headers['cache-control']).toBe('private, no-store');
  });

  it('marks a permanent (301) redirect private, no-store too', async () => {
    findUnique.mockResolvedValue({ ...ROW, permanent: true });
    const r = await run('/AbC');
    expect(r.redirect?.status).toBe(301);
    expect(r.event.headers['cache-control']).toBe('private, no-store');
  });

  it('marks the unlock redirect private, no-store', async () => {
    findUnique.mockResolvedValue({ ...ROW, passwordHash: HASH });
    const { redirect, event } = await unlock('/AbC', 'hunter2');
    expect(redirect?.status).toBe(303);
    expect(event.headers['cache-control']).toBe('private, no-store');
  });

  it.each([
    ['expired', { expiredAt: new Date() }],
    ['flagged', { safeVerdict: 'malware' }],
    ['password', { passwordHash: 'x' }]
  ])('marks the %s view private, no-store so a later change applies', async (_n, over) => {
    findUnique.mockResolvedValue({ ...ROW, ...over });
    const r = await run('/AbC');
    expect(r.event.headers['cache-control']).toBe('private, no-store');
  });
});

describe('views', () => {
  it('throws 403 for flagged, no click and no destination', async () => {
    findUnique.mockResolvedValue({ ...ROW, safeVerdict: 'phishing' });
    const r = await run('/AbC');
    expect(r.error.status).toBe(403);
    expect(r.error.body).toMatchObject({ view: 'flagged', verdict: 'phishing' });
    expect(JSON.stringify(r.error.body)).not.toContain('example.com');
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('throws 403 for a link flagged by a rule destination, even when the rule matches', async () => {
    findUnique.mockResolvedValue({
      ...ROW,
      safeVerdict: 'malware',
      rules: [{ id: 'abcdefgh', when: { countries: ['SG'] }, destination: 'https://bad.example.com/' }]
    });
    const r = await run('/AbC', { 'x-iksi-edge': 'edge', 'x-iksi-client-country': 'SG' });
    expect(r.error.status).toBe(403);
    expect(r.error.body).toMatchObject({ view: 'flagged', verdict: 'malware' });
    expect(JSON.stringify(r.error.body)).not.toContain('bad.example.com');
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('throws 410 for expired when expiresAt is past', async () => {
    findUnique.mockResolvedValue({ ...ROW, expiresAt: new Date(Date.now() - 1000) });
    const r = await run('/AbC');
    expect(r.error.status).toBe(410);
    expect(r.error.body).toMatchObject({ view: 'expired', message: 'This link has expired.' });
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('throws 410 when expiredAt is set', async () => {
    findUnique.mockResolvedValue({ ...ROW, expiredAt: new Date() });
    const r = await run('/AbC');
    expect(r.error.status).toBe(410);
    expect(r.error.body).toMatchObject({ view: 'expired' });
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
      hasRules: false,
      flagged: null,
      expired: false,
      oneTime: false,
      opened: false
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

  it('marks a flagged link with its verdict and withholds the destination', async () => {
    findUnique.mockResolvedValue({ ...ROW, safeVerdict: 'malware' });
    const r = await run('/AbC+');
    expect(r.data).toMatchObject({ view: 'preview', flagged: 'malware', expired: false, host: 'example.com', destination: null });
  });

  it('marks an expired link and withholds the destination', async () => {
    findUnique.mockResolvedValue({ ...ROW, expiredAt: new Date() });
    const r = await run('/AbC+');
    expect(r.data).toMatchObject({ view: 'preview', flagged: null, expired: true, destination: null });
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

  it('rejects a password over 128 characters without comparing', async () => {
    const { result } = await unlock('/AbC', 'a'.repeat(129));
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

  it('a protected link one click from its cap expires after the unlock that reaches it', async () => {
    // The origin records the click itself; ingest's exhaust never sees it.
    const row = { ...ROW, passwordHash: HASH, clickCount: 3, maxClicks: 4 };
    findUnique.mockImplementation(async () => ({ ...row }));
    recordClick.mockImplementation(async () => {
      row.clickCount++;
    });
    const first = await unlock('/AbC', 'hunter2');
    expect(first.redirect).toEqual({ status: 303, location: 'https://example.com/' });
    expect(recordClick).toHaveBeenCalledTimes(1);

    const next = await run('/AbC');
    expect(next.error?.status).toBe(410);
    expect(next.error?.body).toMatchObject({ view: 'expired' });

    expect(findUnique.mock.calls[0][0].select).toMatchObject({ clickCount: true, maxClicks: true });
    const again = await unlock('/AbC', 'hunter2');
    expect(again.redirect).toEqual({ status: 303, location: '/AbC' });
    expect(recordClick).toHaveBeenCalledTimes(1);
  });

  it('sends a link that is no longer protected back to the plain route', async () => {
    findUnique.mockResolvedValue({ ...ROW, passwordHash: null });
    const { redirect } = await unlock('/AbC', 'x');
    expect(redirect).toEqual({ status: 303, location: '/AbC' });
    expect(recordClick).not.toHaveBeenCalled();
  });
});

describe('one-time links', () => {
  const SECRET_TEXT = 'the vault code is 4521';
  const SECRET_URL = 'https://secret.example/doc?k=1';
  const FUTURE = () => new Date(Date.now() + 7 * 86400000);

  /** One row shared by every lookup and claim, so a claim is visible to the next request. */
  function oneTimeRow(over: Record<string, unknown> = {}) {
    const state: Record<string, any> = {
      ...ROW,
      originalURL: '',
      oneTime: true,
      secretKind: 'text',
      secret: `enc:${SECRET_TEXT}`,
      openedAt: null,
      expiresAt: FUTURE(),
      ...over
    };
    findUnique.mockImplementation(async ({ select }: { select: Record<string, boolean> }) => {
      const snap: Record<string, any> = {};
      for (const k of Object.keys(select)) if (k in state) snap[k] = state[k];
      return snap;
    });
    // Behaves like Postgres running the conditional UPDATE: the WHERE is checked
    // against the row as it is when the statement runs.
    executeRaw.mockImplementation(async (q: { values: unknown[] }) => {
      await new Promise((r) => setTimeout(r, 0));
      const [at, id, cutoff] = q.values as [Date, number, Date];
      const live =
        state.id === id &&
        state.oneTime &&
        state.openedAt === null &&
        state.secret !== null &&
        state.expiredAt === null &&
        (state.expiresAt === null || state.expiresAt > cutoff);
      if (!live) return 0;
      state.openedAt = at;
      state.secret = null;
      return 1;
    });
    return state;
  }

  async function reveal(path: string, password: string | null = null) {
    const body = new FormData();
    if (password !== null) body.set('password', password);
    const event = makeEvent(path, { method: 'POST', body });
    try {
      const result: any = await (actions as any).reveal(event as never);
      return { result, event } as any;
    } catch (e: any) {
      if (e?.location) return { redirect: { status: e.status, location: e.location }, event } as any;
      if (typeof e?.status === 'number') return { error: { status: e.status, body: e.body }, event } as any;
      throw e;
    }
  }

  describe('viewing never burns', () => {
    it('GET shows the reveal page without the content and without reading it', async () => {
      oneTimeRow();
      const r = await run('/AbC');
      expect(r.data).toEqual({ view: 'reveal', kind: 'text', password: false, error: null });
      expect(JSON.stringify(r.data)).not.toContain('vault');
      expect(findUnique.mock.calls[0][0].select.secret).toBeUndefined();
      expect(executeRaw).not.toHaveBeenCalled();
      expect(recordClick).not.toHaveBeenCalled();
      expect(r.event.headers['cache-control']).toBe('private, no-store');
    });

    it('HEAD does not burn', async () => {
      const state = oneTimeRow();
      const r = await run('/AbC', {}, 'HEAD');
      expect(r.data.view).toBe('reveal');
      expect(executeRaw).not.toHaveBeenCalled();
      expect(state.secret).toBe(`enc:${SECRET_TEXT}`);
    });

    it('a SvelteKit data request (hover preload) does not burn', async () => {
      const state = oneTimeRow();
      const event: any = makeEvent('/AbC');
      event.isDataRequest = true;
      const data: any = await load(event);
      expect(data.view).toBe('reveal');
      expect(executeRaw).not.toHaveBeenCalled();
      expect(state.secret).toBe(`enc:${SECRET_TEXT}`);
    });

    it('a GET carrying the action query does not burn', async () => {
      oneTimeRow();
      const r = await run('/AbC?/reveal');
      expect(r.data.view).toBe('reveal');
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('many GETs (link preview bots) leave it openable', async () => {
      oneTimeRow();
      for (let i = 0; i < 5; i++) await run('/AbC');
      const { result } = await reveal('/AbC');
      expect(result).toEqual({ text: SECRET_TEXT });
    });

    it('the preview hides the content and does not burn', async () => {
      oneTimeRow({ secretKind: 'url', secret: `enc:${SECRET_URL}` });
      const r = await run('/AbC+');
      expect(r.data).toMatchObject({ view: 'preview', oneTime: true, destination: null, host: '', opened: false });
      expect(JSON.stringify(r.data)).not.toContain('secret.example');
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('a URL secret says it opens a website', async () => {
      oneTimeRow({ secretKind: 'url', secret: `enc:${SECRET_URL}` });
      expect((await run('/AbC')).data).toMatchObject({ view: 'reveal', kind: 'url' });
    });
  });

  describe('reveal', () => {
    it('shows a text secret once and erases it from the row', async () => {
      const state = oneTimeRow();
      const { result, event } = await reveal('/AbC');
      expect(result).toEqual({ text: SECRET_TEXT });
      expect(executeRaw).toHaveBeenCalledTimes(1);
      expect(state.secret).toBeNull();
      expect(state.openedAt).toBeInstanceOf(Date);
      expect(event.headers['cache-control']).toBe('private, no-store');
      expect(recordClick).toHaveBeenCalledTimes(1);
    });

    it('redirects a URL secret with 303 and erases it', async () => {
      const state = oneTimeRow({ secretKind: 'url', secret: `enc:${SECRET_URL}` });
      const { redirect, event } = await reveal('/AbC');
      expect(redirect).toEqual({ status: 303, location: SECRET_URL });
      expect(state.secret).toBeNull();
      expect(event.headers['cache-control']).toBe('private, no-store');
    });

    it('two concurrent reveals: exactly one gets the content, the other sees already opened', async () => {
      oneTimeRow();
      const [a, b] = await Promise.all([reveal('/AbC'), reveal('/AbC')]);
      // Both passed every check in code and reached the claim; the UPDATE decided.
      expect(executeRaw).toHaveBeenCalledTimes(2);
      const results = [a.result, b.result];
      const winners = results.filter((r) => r?.text === SECRET_TEXT);
      const losers = results.filter((r) => r?.status === 410);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect(losers[0].data).toEqual({ opened: true });
      expect(JSON.stringify(losers[0])).not.toContain('vault');
      expect(recordClick).toHaveBeenCalledTimes(1);
    });

    it('two concurrent URL reveals: exactly one is redirected', async () => {
      oneTimeRow({ secretKind: 'url', secret: `enc:${SECRET_URL}` });
      const [a, b] = await Promise.all([reveal('/AbC'), reveal('/AbC')]);
      expect([a, b].filter((r) => r.redirect?.location === SECRET_URL)).toHaveLength(1);
      expect([a, b].filter((r) => r.result?.status === 410)).toHaveLength(1);
    });

    it('after the reveal the link is a 410 already opened page', async () => {
      oneTimeRow();
      await reveal('/AbC');
      const r = await run('/AbC');
      expect(r.error.status).toBe(410);
      expect(r.error.body).toMatchObject({ view: 'opened', message: 'This link was already opened.' });
    });

    it('a second reveal gets already opened and no content', async () => {
      oneTimeRow();
      await reveal('/AbC');
      const { result } = await reveal('/AbC');
      expect(result.status).toBe(410);
      expect(result.data).toEqual({ opened: true });
      expect(executeRaw).toHaveBeenCalledTimes(1);
    });

    it('the page rendered after a no-JS reveal POST shows the result, not an error', async () => {
      oneTimeRow();
      await reveal('/AbC');
      // SvelteKit runs load after a non-enhanced action on the same POST.
      const event: any = makeEvent('/AbC', { method: 'POST', body: new FormData() });
      expect(await load(event)).toEqual({ view: 'opened' });
    });

    it('a row whose content is already gone is never claimed', async () => {
      oneTimeRow({ secret: null });
      const { result } = await reveal('/AbC');
      expect(result.status).toBe(410);
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('content that cannot be decrypted is not burned', async () => {
      const crypto = await import('#lib/server/crypto.js');
      vi.mocked(crypto.decodeURL).mockImplementationOnce(async (s: string) => s);
      const state = oneTimeRow({ secret: 'aa:bb:cc' });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const r = await reveal('/AbC');
      expect(r.error?.status).toBe(500);
      expect(state.secret).toBe('aa:bb:cc');
      expect(executeRaw).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('a normal link has no reveal: it goes back to the plain route', async () => {
      findUnique.mockResolvedValue({ ...ROW });
      const { redirect } = await reveal('/AbC');
      expect(redirect).toEqual({ status: 303, location: '/AbC' });
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('the unlock action never reveals a one-time link', async () => {
      oneTimeRow({ passwordHash: HASH });
      const { redirect } = await unlock('/AbC', 'hunter2');
      expect(redirect).toEqual({ status: 303, location: '/AbC' });
      expect(executeRaw).not.toHaveBeenCalled();
      expect(recordClick).not.toHaveBeenCalled();
    });
  });

  describe('with a password', () => {
    it('the reveal page asks for the password', async () => {
      oneTimeRow({ passwordHash: HASH });
      const r = await run('/AbC');
      expect(r.data).toEqual({ view: 'reveal', kind: 'text', password: true, error: null });
    });

    it('a wrong or missing password never claims the link', async () => {
      const state = oneTimeRow({ passwordHash: HASH });
      for (const pw of ['nope', null, 'a'.repeat(129)]) {
        const { result } = await reveal('/AbC', pw);
        expect(result.status).toBe(400);
        expect(result.data).toEqual({ error: 'Wrong password' });
      }
      expect(executeRaw).not.toHaveBeenCalled();
      expect(state.secret).toBe(`enc:${SECRET_TEXT}`);
    });

    it('the right password reveals it', async () => {
      oneTimeRow({ passwordHash: HASH });
      const { result } = await reveal('/AbC', 'hunter2');
      expect(result).toEqual({ text: SECRET_TEXT });
    });

    it('reveal and unlock share one rate limit key, 10 per 10 minutes', async () => {
      oneTimeRow({ passwordHash: HASH });
      await reveal('/AbC', 'nope');
      findUnique.mockResolvedValue({ ...ROW, passwordHash: HASH });
      await unlock('/AbC', 'nope');
      expect(rateLimit.mock.calls).toEqual([
        ['unlock:AbC:1.2.3.4', 10, 10 * 60 * 1000],
        ['unlock:AbC:1.2.3.4', 10, 10 * 60 * 1000]
      ]);
    });

    it('a rate limited reveal is 429 without checking the password or claiming', async () => {
      const state = oneTimeRow({ passwordHash: HASH });
      rateLimit.mockResolvedValue({ allowed: false });
      const { result } = await reveal('/AbC', 'hunter2');
      expect(result.status).toBe(429);
      expect(result.data).toEqual({ error: 'Too many attempts. Try again in a few minutes.' });
      expect(findUnique).not.toHaveBeenCalled();
      expect(state.secret).toBe(`enc:${SECRET_TEXT}`);
    });
  });

  describe('expired and flagged', () => {
    it('an expired unopened secret shows the expired page', async () => {
      oneTimeRow({ expiresAt: new Date(Date.now() - 1000) });
      const r = await run('/AbC');
      expect(r.error.status).toBe(410);
      expect(r.error.body).toMatchObject({ view: 'expired' });
      expect(JSON.stringify(r.error.body)).not.toContain('vault');
    });

    it('an expired secret is never served by the reveal action', async () => {
      const state = oneTimeRow({ expiresAt: new Date(Date.now() - 1000) });
      const r = await reveal('/AbC');
      expect(r.redirect).toEqual({ status: 303, location: '/AbC' });
      expect(JSON.stringify(r)).not.toContain('vault');
      expect(executeRaw).not.toHaveBeenCalled();
      expect(state.openedAt).toBeNull();
    });

    it('a claim the database refuses (expired or opened meanwhile) serves nothing', async () => {
      oneTimeRow();
      executeRaw.mockImplementationOnce(async () => 0);
      const { result } = await reveal('/AbC');
      expect(result.status).toBe(410);
      expect(JSON.stringify(result)).not.toContain('vault');
    });

    it('an opened link that is also past its expiry says already opened', async () => {
      oneTimeRow({ openedAt: new Date(), secret: null, expiresAt: new Date(Date.now() - 1000) });
      expect((await run('/AbC')).error.body).toMatchObject({ view: 'opened' });
    });

    it('a flagged secret is disabled and never served', async () => {
      oneTimeRow({ safeVerdict: 'phishing', secretKind: 'url', secret: `enc:${SECRET_URL}` });
      const r = await run('/AbC');
      expect(r.error.status).toBe(403);
      expect(JSON.stringify(r.error.body)).not.toContain('secret.example');
      const rv = await reveal('/AbC');
      expect(rv.redirect).toEqual({ status: 303, location: '/AbC' });
      expect(executeRaw).not.toHaveBeenCalled();
    });
  });
});
