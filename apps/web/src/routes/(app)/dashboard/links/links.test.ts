import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
const deleteMany = vi.hoisted(() => vi.fn());
const $transaction = vi.hoisted(() => vi.fn());
const purgeEdge = vi.hoisted(() => vi.fn());
const settleVerdictInBackground = vi.hoisted(() => vi.fn());

vi.mock('#lib/prisma.js', () => ({
  prisma: { longURL: { findUnique, update, delete: del }, profileRow: { deleteMany }, $transaction }
}));
vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession: vi.fn(() => 7) }));
vi.mock('#lib/server/crypto.js', () => ({
  encodeURL: vi.fn((u: string) => `enc:${u}`),
  decodeURL: vi.fn(async (u: string) => u.replace(/^enc:/, ''))
}));
vi.mock('#lib/server/edge-purge.js', () => ({ purgeEdge }));
vi.mock('#lib/server/link-verdict.js', () => ({ settleVerdictInBackground }));

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

describe('dashboard links PATCH destination validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    purgeEdge.mockResolvedValue(true);
    findUnique.mockResolvedValue({ id: 5, userId: 7, shortURL: 'Xy' });
  });

  it.each([
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a host without a dot', 'https://intranet'],
    ['an iksi link (redirect loop)', 'https://iksi.app/abc'],
    ['localhost', 'http://localhost.test:3000'],
    ['an empty string', '   ']
  ])('rejects %s with 400 and writes nothing', async (_name, originalURL) => {
    const r = await call(PATCH, { id: 5, originalURL });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/valid URL/i);
    expect(update).not.toHaveBeenCalled();
    expect(purgeEdge).not.toHaveBeenCalled();
  });

  it('rejects a destination over 2048 characters after prefixing', async () => {
    // 2048 raw characters become 2056 once https:// is added.
    const originalURL = 'e.com/' + 'a'.repeat(2042);
    expect(originalURL).toHaveLength(2048);
    const r = await call(PATCH, { id: 5, originalURL });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/2048/);
    expect(update).not.toHaveBeenCalled();
  });

  it('accepts exactly 2048 characters', async () => {
    const originalURL = 'https://e.com/' + 'a'.repeat(2048 - 'https://e.com/'.length);
    const r = await call(PATCH, { id: 5, originalURL });
    expect(r.status).toBe(200);
  });

  it('stores the prefixed, trimmed destination', async () => {
    const r = await call(PATCH, { id: 5, originalURL: '  example.com/path  ' });
    expect(r.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { originalURL: 'enc:https://example.com/path', safeVerdict: 'pending' }
    });
  });
});

describe('dashboard links PATCH settings', () => {
  const row = { id: 5, userId: 7, shortURL: 'Xy', clickCount: 2 };
  const rules = [{ id: 'rule-aaa', when: { countries: ['SG'] }, destination: 'https://a.example.com/' }];
  const saved = {
    originalURL: 'enc:https://e.com',
    rules,
    expiresAt: null,
    maxClicks: null,
    passwordHash: '$2b$10$secret',
    permanent: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    purgeEdge.mockResolvedValue(true);
    findUnique.mockResolvedValue(row);
    update.mockResolvedValue(saved);
  });

  it('saves rules and purges the slug once', async () => {
    const r = await call(PATCH, { id: 5, rules });
    expect(r.status).toBe(200);
    expect(update.mock.calls[0][0].data.rules).toEqual(rules);
    expect(purgeEdge).toHaveBeenCalledTimes(1);
    expect(purgeEdge).toHaveBeenCalledWith(['Xy']);
    expect(settleVerdictInBackground).not.toHaveBeenCalled();
  });

  it('never returns the password hash', async () => {
    const r = await call(PATCH, { id: 5, rules });
    const text = JSON.stringify(await r.json());
    expect(text).not.toContain('passwordHash');
    expect(text).not.toContain('secret');
    expect(JSON.parse(text).settings.hasPassword).toBe(true);
  });

  it('re-checks a changed destination in the background without awaiting it', async () => {
    const r = await call(PATCH, { id: 5, destination: 'example.com' });
    expect(r.status).toBe(200);
    expect(settleVerdictInBackground).toHaveBeenCalledWith('Xy', 'https://example.com');
  });

  it('rejects invalid settings with 400 and writes nothing', async () => {
    const r = await call(PATCH, { id: 5, maxClicks: 2 });
    expect(r.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
    expect(purgeEdge).not.toHaveBeenCalled();
  });

  it("does not save or purge another user's link", async () => {
    findUnique.mockResolvedValue({ ...row, userId: 99 });
    const r = await call(PATCH, { id: 5, rules });
    expect(r.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
    expect(purgeEdge).not.toHaveBeenCalled();
    expect(settleVerdictInBackground).not.toHaveBeenCalled();
  });
});
