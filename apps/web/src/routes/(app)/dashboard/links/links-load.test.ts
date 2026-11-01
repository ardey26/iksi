import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.hoisted(() => vi.fn());
const count = vi.hoisted(() => vi.fn());
const decodeURL = vi.hoisted(() => vi.fn(async (u: string) => u.replace(/^enc:/, '')));
vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { findMany, count } } }));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL }));

import { load } from './+page.server';

const base = {
  shortURL: 'Plain12',
  originalURL: 'enc:https://example.com/',
  clickCount: 0,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  safeVerdict: null,
  rules: null,
  expiresAt: null,
  maxClicks: null,
  expiredAt: null,
  passwordHash: null,
  permanent: false,
  oneTime: false,
  secretKind: null,
  openedAt: null,
  profileRows: []
};

const run = () =>
  load({
    parent: async () => ({ user: { id: 7, profileId: 1 } }),
    url: new URL('https://www.iksi.app/dashboard/links')
  } as never) as Promise<{ links: any[] }>;

beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue(2);
});

describe('dashboard links load: one-time links', () => {
  it('never selects the one-time content', async () => {
    findMany.mockResolvedValue([]);
    await run();
    const select = findMany.mock.calls[0][0].select;
    expect(select).toMatchObject({ oneTime: true, secretKind: true, openedAt: true });
    expect(select.secret).toBeUndefined();
  });

  it('shows a one-time link by kind and state, with no destination and no settings', async () => {
    const future = new Date(Date.now() + 86400000);
    findMany.mockResolvedValue([
      { ...base, id: 1 },
      { ...base, id: 2, shortURL: 'OneTime123', originalURL: '', oneTime: true, secretKind: 'text', expiresAt: future },
      { ...base, id: 3, shortURL: 'OneTime456', originalURL: '', oneTime: true, secretKind: 'url', openedAt: new Date() },
      { ...base, id: 4, shortURL: 'OneTime789', originalURL: '', oneTime: true, secretKind: 'url', expiresAt: new Date(Date.now() - 1) }
    ]);
    const { links } = await run();
    const byId = Object.fromEntries(links.map((l) => [l.id, l]));
    expect(byId[1].oneTime).toBeNull();
    expect(byId[1].settings).toBeDefined();
    expect(byId[2]).toMatchObject({ originalURL: '', oneTime: { kind: 'text', state: 'unopened' } });
    expect(byId[2].settings).toBeUndefined();
    expect(byId[3].oneTime).toEqual({ kind: 'url', state: 'opened' });
    expect(byId[4].oneTime).toEqual({ kind: 'url', state: 'expired' });
    expect(decodeURL).toHaveBeenCalledTimes(1);
  });
});
