import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const updateMany = vi.hoisted(() => vi.fn());
const checkURL = vi.hoisted(() => vi.fn());
const purgeEdge = vi.hoisted(() => vi.fn());
vi.mock('#lib/prisma.js', () => ({
  prisma: { longURL: { findMany, update }, profileRow: { updateMany } }
}));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL: vi.fn(async (u: string) => u) }));
vi.mock('#lib/server/safe-browsing.js', () => ({ checkURL }));
vi.mock('#lib/server/edge-purge.js', () => ({ purgeEdge }));

import { GET } from './+server';

const call = () =>
  GET({
    request: new Request('https://www.iksi.app/x', { headers: { authorization: 'Bearer s3' } })
  } as never);

const link = (id: number, shortURL: string, safeVerdict: string | null) => ({
  id, shortURL, safeVerdict, originalURL: `https://e.com/${id}`
});

describe('safe-browsing sweep purge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 's3';
    purgeEdge.mockResolvedValue(true);
  });

  it('purges only links whose verdict changed', async () => {
    findMany.mockResolvedValue([link(1, 'aa', 'safe'), link(2, 'Bb', 'safe')]);
    checkURL.mockResolvedValueOnce('safe').mockResolvedValueOnce('malware');
    await call();
    expect(purgeEdge).toHaveBeenCalledTimes(1);
    expect(purgeEdge).toHaveBeenCalledWith(['Bb']);
  });

  it('still purges earlier changes when a later check throws', async () => {
    findMany.mockResolvedValue([link(1, 'aa', 'safe'), link(2, 'Bb', 'safe')]);
    checkURL.mockResolvedValueOnce('malware').mockRejectedValueOnce(new Error('boom'));
    await expect(call()).rejects.toThrow('boom');
    expect(purgeEdge).toHaveBeenCalledWith(['aa']);
  });

  it('flushes every 50 changed slugs', async () => {
    const links = Array.from({ length: 120 }, (_, i) => link(i + 1, `s${i}`, 'safe'));
    findMany.mockResolvedValue(links);
    checkURL.mockResolvedValue('malware');
    await call();
    expect(purgeEdge.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
  });
});
