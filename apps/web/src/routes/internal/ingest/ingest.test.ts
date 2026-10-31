import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.hoisted(() => vi.fn());
const createMany = vi.hoisted(() => vi.fn());
const updateMany = vi.hoisted(() => vi.fn());
const profileFindMany = vi.hoisted(() => vi.fn());
const rowFindMany = vi.hoisted(() => vi.fn());
const $transaction = vi.hoisted(() => vi.fn());
vi.mock('#lib/prisma.js', () => ({
  prisma: { longURL: { findMany, updateMany },
    click: { createMany },
    profile: { findMany: profileFindMany },
    profileRow: { findMany: rowFindMany },
    $transaction }
}));

import { POST } from './+server';

function call(body: unknown, headers: Record<string, string> = {}) {
  const url = new URL('https://www.iksi.app/internal/ingest');
  const request = new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  return POST({ url, request } as never);
}

const good = {
  v: 1,
  linkId: 3,
  ts: 1_700_000_000_000,
  country: 'PH',
  userAgent: 'Mozilla/5.0 Chrome/120.0 Safari/537.36',
  referer: null,
  surface: 'direct',
  profileId: null,
  rowId: null
};

beforeEach(() => {
  process.env.EDGE_SECRET = 'edge';
  findMany.mockReset();
  createMany.mockReset();
  updateMany.mockReset();
  profileFindMany.mockReset().mockResolvedValue([]);
  rowFindMany.mockReset().mockResolvedValue([]);
  $transaction.mockReset();
});

describe('POST /internal/ingest', () => {
  it('401s without the edge header', async () => {
    const res = await call({ events: [] });
    expect(res.status).toBe(401);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('400s when events is not an array', async () => {
    const res = await call({ events: 'x' }, { 'x-iksi-edge': 'edge' });
    expect(res.status).toBe(400);
  });

  it('400s on invalid json', async () => {
    const res = await call('{nope', { 'x-iksi-edge': 'edge' });
    expect(res.status).toBe(400);
  });

  it('400s for more than 500 events', async () => {
    const res = await call({ events: Array(501).fill(good) }, { 'x-iksi-edge': 'edge' });
    expect(res.status).toBe(400);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('200s with counts for a valid body', async () => {
    findMany.mockResolvedValue([{ id: 3 }]);
    createMany.mockResolvedValue({ count: 1 });
    $transaction.mockResolvedValue([]);
    const res = await call({ events: [good, null] }, { 'x-iksi-edge': 'edge' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 1, dropped: 1 });
    expect(createMany).toHaveBeenCalledTimes(1);
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it('5xxs when the transaction rejects so the queue retries', async () => {
    findMany.mockResolvedValue([{ id: 3 }]);
    $transaction.mockRejectedValue(new Error('db down'));
    const res = await call({ events: [good] }, { 'x-iksi-edge': 'edge' });
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it('accepts a click whose profile was deleted', async () => {
    findMany.mockResolvedValue([{ id: 3 }]);
    profileFindMany.mockResolvedValue([]);
    $transaction.mockResolvedValue([]);
    const res = await call(
      { events: [{ ...good, surface: 'profile', profileId: 7, rowId: 9 }] },
      { 'x-iksi-edge': 'edge' }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 1, dropped: 0 });
    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ profileId: null, rowId: null })]
    });
  });
});
