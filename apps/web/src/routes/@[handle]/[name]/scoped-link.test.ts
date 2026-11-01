// A profile-scoped link (/@handle/name) goes through the same decision code as
// a plain slug; these cover each decision path through the scoped route.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

const findUnique = vi.hoisted(() => vi.fn());
const recordClick = vi.hoisted(() => vi.fn());
const waitUntil = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const executeRaw = vi.hoisted(() => vi.fn());
const addCacheTag = vi.hoisted(() => vi.fn());

vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { findUnique }, $executeRaw: executeRaw } }));
vi.mock('#lib/server/crypto.js', () => ({
  decodeURL: vi.fn(async (s: string) => (s.startsWith('enc:') ? s.slice(4) : s))
}));
vi.mock('#lib/server/tracking.js', () => ({ recordClick }));
vi.mock('@vercel/functions', () => ({ waitUntil, addCacheTag, dangerouslyDeleteByTag: vi.fn() }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit }));

import { load, actions } from './+page.server';

const HASH = bcrypt.hashSync('hunter2', 4);

const ROW = {
  id: 21,
  originalURL: 'https://example.com/sale',
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

function makeEvent(path: string, init: { method?: string; body?: FormData } = {}) {
  const url = new URL(`https://www.iksi.app${path}`);
  const [, handle, name] = url.pathname.split('/');
  const headers: Record<string, string> = {};
  return {
    url,
    params: { handle: handle.slice(1), name },
    headers,
    setHeaders: (h: Record<string, string>) => {
      for (const [k, v] of Object.entries(h)) {
        if (k.toLowerCase() in headers) throw new Error(`header ${k} already set`);
        headers[k.toLowerCase()] = v;
      }
    },
    request: new Request(url, { method: init.method ?? 'GET', body: init.body }),
    locals: {} as Record<string, unknown>,
    getClientAddress: () => '1.2.3.4'
  };
}

async function settle<T>(event: ReturnType<typeof makeEvent>, fn: () => Promise<T>) {
  try {
    return { data: (await fn()) as any, event } as any;
  } catch (e: any) {
    if (e?.location) return { redirect: { status: e.status, location: e.location }, event } as any;
    if (typeof e?.status === 'number') return { error: { status: e.status, body: e.body }, event } as any;
    throw e;
  }
}

const run = (path: string) => {
  const event = makeEvent(path);
  return settle(event, () => load(event as never));
};

const act = (name: 'unlock' | 'reveal', path: string, password: string | null = null) => {
  const body = new FormData();
  if (password !== null) body.set('password', password);
  const event = makeEvent(path, { method: 'POST', body });
  return settle(event, () => (actions as any)[name](event as never));
};

beforeEach(() => {
  vi.clearAllMocks();
  recordClick.mockResolvedValue(undefined);
  rateLimit.mockResolvedValue({ allowed: true });
  findUnique.mockResolvedValue({ ...ROW });
});

const lookedUp = () => findUnique.mock.calls.map(([q]) => q.where.shortURL);

describe('/@handle/name', () => {
  it('redirects through the stored @handle/name and records the click', async () => {
    const r = await run('/@andre/sale?s=profile&p=4&r=5');
    expect(r.redirect).toEqual({ status: 302, location: 'https://example.com/sale' });
    expect(lookedUp()).toEqual(['@andre/sale']);
    expect(recordClick).toHaveBeenCalledTimes(1);
    expect(recordClick.mock.calls[0][0]).toBe(21);
    expect(recordClick.mock.calls[0][2]).toMatchObject({ surface: 'profile', profileId: 4, rowId: 5 });
    expect(r.event.headers['cache-control']).toBe('private, no-store');
  });

  it('reads the handle in any case', async () => {
    const r = await run('/@AnDre/sale');
    expect(r.redirect?.status).toBe(302);
    expect(lookedUp()).toEqual(['@andre/sale']);
  });

  it('404s an unknown name with the plain not-found page', async () => {
    findUnique.mockResolvedValue(null);
    const r = await run('/@andre/nope');
    expect(r.error?.status).toBe(404);
    expect(r.error?.body?.view).toBeUndefined();
  });

  it('shows the password page and never the destination', async () => {
    findUnique.mockResolvedValue({ ...ROW, passwordHash: HASH });
    const r = await run('/@andre/sale');
    expect(r.data).toEqual({ view: 'password', error: null });
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('unlocks with the right password, rate-limited per scoped name and visitor', async () => {
    findUnique.mockResolvedValue({ ...ROW, passwordHash: HASH });
    const wrong = await act('unlock', '/@andre/sale', 'nope');
    expect(wrong.data.status).toBe(400);
    const right = await act('unlock', '/@andre/sale', 'hunter2');
    expect(right.redirect).toEqual({ status: 303, location: 'https://example.com/sale' });
    expect(recordClick).toHaveBeenCalledTimes(1);
    expect(rateLimit).toHaveBeenCalledWith('unlock:@andre/sale:1.2.3.4', 10, 10 * 60 * 1000);
  });

  it('sends an unprotected link back to its own scoped path', async () => {
    const r = await act('unlock', '/@andre/sale', 'x');
    expect(r.redirect).toEqual({ status: 303, location: '/@andre/sale' });
  });

  it('410s an expired link', async () => {
    findUnique.mockResolvedValue({ ...ROW, expiresAt: new Date(Date.now() - 1000) });
    const r = await run('/@andre/sale');
    expect(r.error?.status).toBe(410);
    expect(r.error?.body).toMatchObject({ view: 'expired' });
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('403s a flagged link', async () => {
    findUnique.mockResolvedValue({ ...ROW, safeVerdict: 'phishing' });
    const r = await run('/@andre/sale');
    expect(r.error?.status).toBe(403);
    expect(r.error?.body).toMatchObject({ view: 'flagged', verdict: 'phishing' });
  });

  it('previews with a trailing +', async () => {
    const r = await run('/@andre/sale+');
    expect(r.data).toMatchObject({ view: 'preview', host: 'example.com', destination: 'https://example.com/sale' });
    expect(lookedUp()).toEqual(['@andre/sale']);
    expect(recordClick).not.toHaveBeenCalled();
  });

  it('never tags the response as a cached profile page', async () => {
    await run('/@andre/sale');
    expect(addCacheTag).not.toHaveBeenCalled();
  });

  describe('one-time', () => {
    function oneTimeRow() {
      const state: Record<string, any> = {
        ...ROW,
        originalURL: '',
        oneTime: true,
        secretKind: 'text',
        secret: 'enc:the code is 4521',
        expiresAt: new Date(Date.now() + 86400000)
      };
      findUnique.mockImplementation(async ({ select }: { select: Record<string, boolean> }) => {
        const snap: Record<string, any> = {};
        for (const k of Object.keys(select)) if (k in state) snap[k] = state[k];
        return snap;
      });
      executeRaw.mockImplementation(async () => {
        if (state.openedAt !== null) return 0;
        state.openedAt = new Date();
        state.secret = null;
        return 1;
      });
      return state;
    }

    it('shows the reveal page on GET without reading the content', async () => {
      oneTimeRow();
      const r = await run('/@andre/sale');
      expect(r.data).toEqual({ view: 'reveal', kind: 'text', password: false, error: null });
    });

    it('reveals once, records the click, then reports it opened', async () => {
      const state = oneTimeRow();
      const first = await act('reveal', '/@andre/sale');
      expect(first.data).toEqual({ text: 'the code is 4521' });
      expect(state.secret).toBeNull();
      expect(recordClick).toHaveBeenCalledTimes(1);
      const again = await run('/@andre/sale');
      expect(again.error?.status).toBe(410);
      expect(again.error?.body).toMatchObject({ view: 'opened' });
    });
  });
});
