import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.hoisted(() => vi.fn());
vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { findUnique } } }));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL: vi.fn(async (s: string) => s) }));

import { GET } from './+server';

function call(slug: string | null, headers: Record<string, string> = {}) {
  const url = new URL('https://www.iksi.app/internal/resolve');
  if (slug !== null) url.searchParams.set('slug', slug);
  return GET({ url, request: new Request(url, { headers }) } as never);
}

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
    const res = await call('AbC', { 'x-iksi-edge': 'nope' });
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('404s for an unknown slug', async () => {
    findUnique.mockResolvedValue(null);
    const res = await call('AbC', { 'x-iksi-edge': 'edge' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ found: false });
  });

  it('returns the record for a known slug, case preserved', async () => {
    findUnique.mockResolvedValue({ id: 9, originalURL: 'https://example.com', safeVerdict: null });
    const res = await call('AbC', { 'x-iksi-edge': 'edge' });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      found: true,
      record: { v: 1, id: 9, destination: 'https://example.com', flagged: false, permanent: false }
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shortURL: 'AbC' } })
    );
  });

  it('400s for a 65-char slug', async () => {
    const res = await call('a'.repeat(65), { 'x-iksi-edge': 'edge' });
    expect(res.status).toBe(400);
  });

  it('400s for a missing slug', async () => {
    const res = await call(null, { 'x-iksi-edge': 'edge' });
    expect(res.status).toBe(400);
  });
});
