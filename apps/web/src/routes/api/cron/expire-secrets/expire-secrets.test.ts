import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const db = vi.hoisted(() => ({
  updateMany: vi.fn(),
  rateLimitDelete: vi.fn(),
  claimDelete: vi.fn()
}));
vi.mock('#lib/prisma.js', () => ({
  prisma: {
    longURL: { updateMany: db.updateMany },
    rateLimit: { deleteMany: db.rateLimitDelete },
    handleClaimRateLimit: { deleteMany: db.claimDelete }
  }
}));

import { GET } from './+server';

const DAY = 24 * 60 * 60 * 1000;

const call = (auth?: string) =>
  GET({ request: new Request('https://www.iksi.app/api/cron/expire-secrets', { headers: auth ? { authorization: auth } : {} }) } as never);

describe('expire-secrets cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    db.updateMany.mockResolvedValue({ count: 3 });
    db.rateLimitDelete.mockResolvedValue({ count: 40 });
    db.claimDelete.mockResolvedValue({ count: 2 });
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.useRealTimers();
  });

  it('erases the content of one-time links that expired unopened', async () => {
    const r = await call('Bearer cron-secret');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ erased: 3, rateLimits: { rateLimits: 40, handleClaims: 2 } });
    const arg = db.updateMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({ oneTime: true, openedAt: null, secret: { not: null } });
    expect(arg.where.expiresAt.lt).toBeInstanceOf(Date);
    expect(arg.data).toEqual({ secret: null });
  });

  it('deletes rate-limit counters of both tables whose window ended over a day ago', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T03:30:00Z'));
    await call('Bearer cron-secret');
    const cutoff = new Date(Date.now() - DAY);
    expect(db.rateLimitDelete).toHaveBeenCalledWith({ where: { resetAt: { lt: cutoff } } });
    expect(db.claimDelete).toHaveBeenCalledWith({ where: { resetAt: { lt: cutoff } } });
  });

  it('refuses a wrong secret', async () => {
    expect((await call('Bearer nope')).status).toBe(401);
    expect(db.updateMany).not.toHaveBeenCalled();
    expect(db.rateLimitDelete).not.toHaveBeenCalled();
    expect(db.claimDelete).not.toHaveBeenCalled();
  });

  it('refuses everything when CRON_SECRET is unset, even "Bearer undefined"', async () => {
    delete process.env.CRON_SECRET;
    expect((await call('Bearer undefined')).status).toBe(401);
    expect(db.updateMany).not.toHaveBeenCalled();
    expect(db.rateLimitDelete).not.toHaveBeenCalled();
    expect(db.claimDelete).not.toHaveBeenCalled();
  });
});
