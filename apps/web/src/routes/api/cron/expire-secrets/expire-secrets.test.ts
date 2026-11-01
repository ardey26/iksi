import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const updateMany = vi.hoisted(() => vi.fn());
vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { updateMany } } }));

import { GET } from './+server';

const call = (auth?: string) =>
  GET({ request: new Request('https://www.iksi.app/api/cron/expire-secrets', { headers: auth ? { authorization: auth } : {} }) } as never);

describe('expire-secrets cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    updateMany.mockResolvedValue({ count: 3 });
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('erases the content of one-time links that expired unopened', async () => {
    const r = await call('Bearer cron-secret');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ erased: 3 });
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({ oneTime: true, openedAt: null, secret: { not: null } });
    expect(arg.where.expiresAt.lt).toBeInstanceOf(Date);
    expect(arg.data).toEqual({ secret: null });
  });

  it('refuses a wrong secret', async () => {
    expect((await call('Bearer nope')).status).toBe(401);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('refuses everything when CRON_SECRET is unset, even "Bearer undefined"', async () => {
    delete process.env.CRON_SECRET;
    expect((await call('Bearer undefined')).status).toBe(401);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
