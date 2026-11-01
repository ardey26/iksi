import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  limits: new Map<string, { id: string; count: number; resetAt: Date }>(),
  findUnique: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  handleCreate: vi.fn()
}));
vi.mock('#lib/prisma.js', () => ({
  prisma: {
    handleClaimRateLimit: { findUnique: db.findUnique, update: db.update, upsert: db.upsert },
    handle: { create: db.handleCreate }
  }
}));
vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession: () => 7 }));
vi.mock('#lib/server/user-cache.js', () => ({ invalidateUserCache: () => {} }));

import { POST } from './+server';
import { hashIp } from '#lib/server/ip-hash.js';

// Rate-limit keys hold a keyed hash of the IP, so hashing needs a key.
process.env.SECRET_KEY ||= 'k'.repeat(32);

const IP = '198.51.100.23';

const claim = (handle = 'ann') =>
  POST({
    request: new Request('https://www.iksi.app/dashboard/claim', { method: 'POST', body: JSON.stringify({ handle }) }),
    cookies: { get: () => 'session' },
    getClientAddress: () => IP
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  db.limits.clear();
  db.findUnique.mockImplementation(async ({ where }) => db.limits.get(where.id) ?? null);
  db.update.mockImplementation(async ({ where }) => {
    db.limits.get(where.id)!.count++;
  });
  db.upsert.mockImplementation(async ({ where, create }) => {
    db.limits.set(where.id, { ...create });
  });
  db.handleCreate.mockResolvedValue({});
});

describe('POST /dashboard/claim rate limit', () => {
  it('keys the per-visitor counter by a keyed hash of the IP, never the raw IP', async () => {
    expect((await claim()).status).toBe(200);
    const ids = db.upsert.mock.calls.map(([arg]) => arg.where.id);
    expect(ids).toEqual([`handle_claim:ip:${hashIp(IP)}`, 'handle_claim:user:7']);
    expect(JSON.stringify([db.findUnique.mock.calls, db.upsert.mock.calls, db.update.mock.calls])).not.toContain(IP);
  });

  it('429s the 4th claim from one visitor in an hour', async () => {
    // Fresh user counters each time, so only the per-IP limit (3/hour) can trip.
    for (let i = 0; i < 3; i++) {
      db.limits.delete('handle_claim:user:7');
      expect((await claim()).status).toBe(200);
    }
    db.limits.delete('handle_claim:user:7');
    expect((await claim()).status).toBe(429);
    expect(db.limits.get(`handle_claim:ip:${hashIp(IP)}`)?.count).toBe(3);
  });
});
