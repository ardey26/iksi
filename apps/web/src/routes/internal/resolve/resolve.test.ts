import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.hoisted(() => vi.fn());
vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { findUnique } } }));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL: vi.fn(async (s: string) => s) }));

import { decideLink, parseLinkRecord } from '@iksi/core';
import { GET } from './+server';

function call(slug: string | null, headers: Record<string, string> = {}) {
  const url = new URL('https://www.iksi.app/internal/resolve');
  if (slug !== null) url.searchParams.set('slug', slug);
  return GET({ url, request: new Request(url, { headers }) } as never);
}

const ROW = {
  id: 9,
  originalURL: 'https://example.com',
  safeVerdict: null,
  rules: null,
  expiresAt: null,
  expiredAt: null,
  passwordHash: null,
  permanent: false,
  clickCount: 0,
  maxClicks: null,
  oneTime: false
};

beforeEach(() => {
  process.env.EDGE_SECRET = 'edge';
  findUnique.mockReset();
});

describe('GET /internal/resolve', () => {
  it('401s without the edge header', async () => {
    const res = await call('AbC');
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('401s with a wrong secret', async () => {
    const res = await call('AbC', { 'x-iksi-internal': 'nope' });
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('401s for the visitor-identity header x-iksi-edge alone, even with the real secret', async () => {
    const res = await call('AbC', { 'x-iksi-edge': 'edge' });
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('200s for a matching x-iksi-internal', async () => {
    findUnique.mockResolvedValue({ ...ROW });
    const res = await call('AbC', { 'x-iksi-internal': 'edge' });
    expect(res.status).toBe(200);
  });

  it('404s for an unknown slug', async () => {
    findUnique.mockResolvedValue(null);
    const res = await call('AbC', { 'x-iksi-internal': 'edge' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ found: false });
  });

  it('returns the record for a known slug, case preserved', async () => {
    findUnique.mockResolvedValue({ ...ROW });
    const res = await call('AbC', { 'x-iksi-internal': 'edge' });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      found: true,
      record: {
        v: 2,
        id: 9,
        destination: 'https://example.com',
        flagged: false,
        permanent: false,
        rules: [],
        expiresAt: null,
        expired: false,
        protected: false
      }
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shortURL: 'AbC' } })
    );
  });

  it('selects the click cap and marks a link at its cap expired before ingest does', async () => {
    findUnique.mockResolvedValue({ ...ROW, clickCount: 4, maxClicks: 4 });
    const res = await call('AbC', { 'x-iksi-internal': 'edge' });
    expect((await res.json()).record.expired).toBe(true);
    expect(findUnique.mock.calls[0][0].select).toMatchObject({ clickCount: true, maxClicks: true });
  });

  it('a one-time link is protected for the edge, with no secret and no content selected', async () => {
    findUnique.mockResolvedValue({ ...ROW, oneTime: true, originalURL: '' });
    const res = await call('AbC', { 'x-iksi-internal': 'edge' });
    const { record } = await res.json();
    expect(record.protected).toBe(true);
    expect(record.v).toBe(2);
    const select = findUnique.mock.calls[0][0].select;
    expect(select).toMatchObject({ oneTime: true });
    expect(select.secret).toBeUndefined();
  });

  it('400s for a 65-char slug', async () => {
    const res = await call('a'.repeat(65), { 'x-iksi-internal': 'edge' });
    expect(res.status).toBe(400);
  });

  it('400s for a missing slug', async () => {
    const res = await call(null, { 'x-iksi-internal': 'edge' });
    expect(res.status).toBe(400);
  });

  describe('a link held for review or disabled', () => {
    it.each(['review', 'disabled'])('%s: the record is flagged, so the edge never redirects it', async (moderation) => {
      findUnique.mockResolvedValue({ ...ROW, safeVerdict: 'safe', moderation });
      const res = await call('AbC', { 'x-iksi-internal': 'edge' });
      const { record } = await res.json();
      expect(record.flagged).toBe(true);
      // What the Worker does with it: parse, decide, and only 'redirect' is answered at the edge.
      const parsed = parseLinkRecord(record);
      expect(parsed).not.toBeNull();
      expect(decideLink(parsed!, Date.now())).toBe('flagged');
    });

    it('reads moderation from the database', async () => {
      findUnique.mockResolvedValue({ ...ROW, moderation: null });
      await call('AbC', { 'x-iksi-internal': 'edge' });
      expect(findUnique.mock.calls[0][0].select).toMatchObject({ moderation: true });
    });

    it('a link with the hold lifted redirects at the edge again', async () => {
      findUnique.mockResolvedValue({ ...ROW, safeVerdict: 'safe', moderation: null });
      const { record } = await (await call('AbC', { 'x-iksi-internal': 'edge' })).json();
      expect(decideLink(parseLinkRecord(record)!, Date.now())).toBe('redirect');
    });
  });
});
