import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
const deleteMany = vi.hoisted(() => vi.fn());
const $transaction = vi.hoisted(() => vi.fn());
const purgeEdge = vi.hoisted(() => vi.fn());

vi.mock('#lib/prisma.js', () => ({
  prisma: { longURL: { findUnique, update, delete: del }, profileRow: { deleteMany }, $transaction }
}));
vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession: vi.fn(() => 7) }));
vi.mock('#lib/server/crypto.js', () => ({ encodeURL: vi.fn((u: string) => `enc:${u}`) }));
vi.mock('#lib/server/edge-purge.js', () => ({ purgeEdge }));

import { PATCH, DELETE } from './+server';

function call(handler: typeof PATCH, body: unknown) {
  const request = new Request('https://www.iksi.app/dashboard/links', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return handler({ request, cookies: { get: () => 'tok' } } as never);
}

describe('dashboard links purge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    purgeEdge.mockResolvedValue(true);
    $transaction.mockResolvedValue([]);
  });

  it('PATCH purges the slug after the update', async () => {
    findUnique.mockResolvedValue({ id: 5, userId: 7, shortURL: 'Xy' });
    const order: string[] = [];
    update.mockImplementation(async () => { order.push('update'); });
    purgeEdge.mockImplementation(async () => { order.push('purge'); return true; });
    const r = await call(PATCH, { id: 5, originalURL: 'https://e.com' });
    expect(r.status).toBe(200);
    expect(purgeEdge).toHaveBeenCalledWith(['Xy']);
    expect(order).toEqual(['update', 'purge']);
  });

  it('DELETE purges the slug after the delete', async () => {
    findUnique.mockResolvedValue({ id: 5, userId: 7, shortURL: 'Xy' });
    const order: string[] = [];
    $transaction.mockImplementation(async () => { order.push('tx'); return []; });
    purgeEdge.mockImplementation(async () => { order.push('purge'); return true; });
    const r = await call(DELETE, { id: 5 });
    expect(r.status).toBe(200);
    expect(purgeEdge).toHaveBeenCalledWith(['Xy']);
    expect(order).toEqual(['tx', 'purge']);
  });

  it("PATCH on another user's link is 404 and purges nothing", async () => {
    findUnique.mockResolvedValue({ id: 5, userId: 99, shortURL: 'Xy' });
    const r = await call(PATCH, { id: 5, originalURL: 'https://e.com' });
    expect(r.status).toBe(404);
    expect(purgeEdge).not.toHaveBeenCalled();
  });

  it('a failing purge does not break the request', async () => {
    findUnique.mockResolvedValue({ id: 5, userId: 7, shortURL: 'Xy' });
    purgeEdge.mockResolvedValue(false);
    const r = await call(PATCH, { id: 5, originalURL: 'https://e.com' });
    expect(r.status).toBe(200);
  });
});
