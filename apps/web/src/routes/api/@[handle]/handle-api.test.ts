import { describe, it, expect, vi, beforeEach } from 'vitest';

const handleFindUnique = vi.hoisted(() => vi.fn());
const limit = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() }));
vi.mock('#lib/prisma.js', () => ({
  prisma: {
    handle: { findUnique: handleFindUnique },
    rateLimit: limit
  }
}));

import { GET } from './+server';
import { hashIp } from '#lib/server/ip-hash.js';

// Rate-limit keys hold a keyed hash of the IP, so hashing needs a key.
process.env.SECRET_KEY ||= 'k'.repeat(32);

const call = () =>
  GET({
    params: { handle: 'ann' },
    request: new Request('https://www.iksi.app/api/@ann'),
    getClientAddress: () => '1.2.3.4'
  } as never);

const row = (title: string, shortURL: string, oneTime = false) => ({
  title,
  link: { shortURL, clickCount: 3, oneTime }
});

beforeEach(() => {
  vi.clearAllMocks();
  limit.findUnique.mockResolvedValue(null);
  limit.upsert.mockResolvedValue({});
  handleFindUnique.mockResolvedValue({
    user: {
      profile: {
        displayName: 'Ann',
        bio: null,
        avatarUrl: null,
        theme: 'default',
        accent: '#3B82F6',
        publicClicks: false,
        rows: [row('GitHub', 'gh1'), row('Secret', 'Sec1234567', true)]
      }
    }
  });
});

describe('GET /api/@handle', () => {
  it('asks the database for rows whose link is not one-time', async () => {
    await call();
    const rows = handleFindUnique.mock.calls[0][0].include.user.include.profile.include.rows;
    expect(rows.where).toMatchObject({ link: { is: { oneTime: false } } });
  });

  it('never lists a one-time link', async () => {
    const body = await (await call()).json();
    expect(body.rows).toEqual([{ title: 'GitHub', url: 'https://iksi.app/gh1' }]);
    expect(JSON.stringify(body)).not.toContain('Sec1234567');
  });
});

describe('GET /api/@handle rate limit', () => {
  const KEY = () => `public_api:ip:${hashIp('1.2.3.4')}`;

  it('keys the counter by a keyed hash of the visitor, never the raw IP', async () => {
    await call();
    expect(limit.findUnique).toHaveBeenCalledWith({ where: { id: KEY() } });
    const { where, create } = limit.upsert.mock.calls[0][0];
    expect(where.id).toBe(KEY());
    expect(create.id).toBe(KEY());
    expect(JSON.stringify([limit.findUnique.mock.calls, limit.upsert.mock.calls])).not.toContain('1.2.3.4');
  });

  it('429s the visitor who used up 100 requests this hour', async () => {
    limit.findUnique.mockResolvedValue({ id: KEY(), count: 100, resetAt: new Date(Date.now() + 60_000) });
    expect((await call()).status).toBe(429);
    expect(handleFindUnique).not.toHaveBeenCalled();
  });

  it('counts a request inside the window', async () => {
    limit.findUnique.mockResolvedValue({ id: KEY(), count: 99, resetAt: new Date(Date.now() + 60_000) });
    expect((await call()).status).toBe(200);
    expect(limit.update).toHaveBeenCalledWith({ where: { id: KEY() }, data: { count: { increment: 1 } } });
  });
});
