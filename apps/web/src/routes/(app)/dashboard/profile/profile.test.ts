import { describe, it, expect, vi, beforeEach } from 'vitest';

const profileFindUnique = vi.hoisted(() => vi.fn());
const linkFindUnique = vi.hoisted(() => vi.fn());
const linkUpdate = vi.hoisted(() => vi.fn());
const rowAggregate = vi.hoisted(() => vi.fn());
const rowCreate = vi.hoisted(() => vi.fn());
const rowFindFirst = vi.hoisted(() => vi.fn());
const rowUpdate = vi.hoisted(() => vi.fn());
const checkURLs = vi.hoisted(() => vi.fn());
const purgeEdge = vi.hoisted(() => vi.fn());

vi.mock('#lib/prisma.js', () => ({
  prisma: {
    profile: { findUnique: profileFindUnique },
    longURL: { findUnique: linkFindUnique, update: linkUpdate },
    profileRow: { aggregate: rowAggregate, create: rowCreate, findFirst: rowFindFirst, update: rowUpdate }
  }
}));
vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession: vi.fn(() => 7) }));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL: vi.fn(async (u: string) => u) }));
vi.mock('#lib/server/safe-browsing.js', () => ({ checkURLs }));
vi.mock('#lib/server/edge-purge.js', () => ({ purgeEdge }));
vi.mock('#lib/server/avatar-url.js', () => ({ verifyAvatarUrl: vi.fn() }));
vi.mock('#lib/server/user-cache.js', () => ({ invalidateUserCache: vi.fn() }));

import { POST } from './+server';

function call(body: unknown) {
  const request = new Request('https://www.iksi.app/dashboard/profile', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return POST({ request, cookies: { get: () => 'tok' } } as never);
}

/** A link owned by the caller whose Safe Browsing check is stale, so it is re-checked. */
const staleLink = (safeVerdict: string | null) => ({
  id: 5,
  userId: 7,
  shortURL: 'Xy',
  originalURL: 'https://e.com',
  safeVerdict,
  safeCheckedAt: null,
  rules: null as unknown
});

const actions = [
  ['addRow', { action: 'addRow', linkId: 5, title: 'T' }],
  ['upsertRow', { action: 'upsertRow', linkId: 5, title: 'T', enabled: true }]
] as const;

describe('dashboard profile verdict changes purge the edge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileFindUnique.mockResolvedValue({ id: 1, userId: 7 });
    rowAggregate.mockResolvedValue({ _max: { position: null } });
    rowCreate.mockResolvedValue({ id: 9 });
    rowFindFirst.mockResolvedValue(null);
    purgeEdge.mockResolvedValue(true);
  });

  describe.each(actions)('%s', (_name, body) => {
    it('a newly flagged verdict is purged after the write, then refused', async () => {
      linkFindUnique.mockResolvedValue(staleLink('safe'));
      checkURLs.mockResolvedValue('malware');
      const order: string[] = [];
      linkUpdate.mockImplementation(async () => { order.push('update'); });
      purgeEdge.mockImplementation(async () => { order.push('purge'); return true; });
      const r = await call(body);
      expect(r.status).toBe(422);
      expect(purgeEdge).toHaveBeenCalledWith(['Xy']);
      expect(order).toEqual(['update', 'purge']);
    });

    it('a verdict that clears a flag is purged too', async () => {
      linkFindUnique.mockResolvedValue(staleLink('phishing'));
      checkURLs.mockResolvedValue('safe');
      const r = await call(body);
      expect(r.status).toBe(200);
      expect(purgeEdge).toHaveBeenCalledWith(['Xy']);
    });

    it('an unchanged verdict does not purge', async () => {
      linkFindUnique.mockResolvedValue(staleLink('safe'));
      checkURLs.mockResolvedValue('safe');
      const r = await call(body);
      expect(r.status).toBe(200);
      expect(linkUpdate).toHaveBeenCalled();
      expect(purgeEdge).not.toHaveBeenCalled();
    });

    it('the re-check covers rule destinations, so a bad rule is not cleared by a clean default', async () => {
      const rules = [{ id: 'rule0001', when: { countries: ['SG'] }, destination: 'https://bad.example/' }];
      linkFindUnique.mockResolvedValue({ ...staleLink('malware'), rules });
      checkURLs.mockImplementation(async (urls: string[]) =>
        urls.includes('https://bad.example/') ? 'malware' : 'safe'
      );
      const r = await call(body);
      expect(r.status).toBe(422);
      expect(checkURLs).toHaveBeenCalledWith(['https://e.com', 'https://bad.example/']);
      expect(linkUpdate.mock.calls[0][0].data.safeVerdict).toBe('malware');
    });

    it('a flagged link stays flagged and refused when Safe Browsing cannot complete the check', async () => {
      linkFindUnique.mockResolvedValue(staleLink('phishing'));
      checkURLs.mockResolvedValue('pending');
      const r = await call(body);
      expect(r.status).toBe(422);
      expect(linkUpdate).not.toHaveBeenCalled();
      expect(purgeEdge).not.toHaveBeenCalled();
    });

    it('a fresh verdict is not re-checked or purged', async () => {
      linkFindUnique.mockResolvedValue({ ...staleLink('safe'), safeCheckedAt: new Date() });
      const r = await call(body);
      expect(r.status).toBe(200);
      expect(checkURLs).not.toHaveBeenCalled();
      expect(purgeEdge).not.toHaveBeenCalled();
    });
  });
});
