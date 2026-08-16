import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/prisma.js', () => {
  const txn = vi.fn(async (ops: unknown[]) => ops.length);
  return {
    prisma: {
      $transaction: txn,
      click: { create: vi.fn((args) => args) },
      longURL: { update: vi.fn((args) => args) },
      profileView: { create: vi.fn() }
    }
  };
});

import { parseUA, normalizeReferrer, recordClick, recordProfileView } from './tracking';

describe('parseUA', () => {
  it('returns Chrome/desktop for a standard Chrome UA', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    expect(parseUA(ua)).toEqual({ browser: 'Chrome', device: 'desktop' });
  });

  it('returns Safari/mobile for iPhone Safari', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(parseUA(ua)).toEqual({ browser: 'Safari', device: 'mobile' });
  });

  it('returns Safari/tablet for iPad', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(parseUA(ua)).toEqual({ browser: 'Safari', device: 'tablet' });
  });

  it('returns Firefox/desktop for Firefox UA', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';
    expect(parseUA(ua)).toEqual({ browser: 'Firefox', device: 'desktop' });
  });

  it('returns Edge/desktop for Edge UA (matches Edg/ before Chrome)', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0';
    expect(parseUA(ua)).toEqual({ browser: 'Edge', device: 'desktop' });
  });

  it('returns Other/bot for Googlebot', () => {
    const ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    expect(parseUA(ua)).toEqual({ browser: 'Other', device: 'bot' });
  });

  it('returns Other/desktop for null/empty UA', () => {
    expect(parseUA(null)).toEqual({ browser: 'Other', device: 'desktop' });
    expect(parseUA('')).toEqual({ browser: 'Other', device: 'desktop' });
  });
});

describe('normalizeReferrer', () => {
  it('returns bare host for a valid URL with path + query', () => {
    expect(normalizeReferrer('https://x.com/some/path?utm=1')).toBe('x.com');
  });

  it('strips leading www.', () => {
    expect(normalizeReferrer('https://www.google.com/search?q=test')).toBe('google.com');
  });

  it('returns null for null/empty', () => {
    expect(normalizeReferrer(null)).toBeNull();
    expect(normalizeReferrer('')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(normalizeReferrer('not-a-url')).toBeNull();
  });

  it('returns null for non-http(s) schemes', () => {
    expect(normalizeReferrer('data:text/plain;base64,abc')).toBeNull();
    expect(normalizeReferrer('file:///etc/passwd')).toBeNull();
  });
});

describe('recordClick', () => {
  it('calls prisma.$transaction with a click insert + counter increment', async () => {
    const { prisma } = await import('$lib/prisma.js');

    const event = {
      request: {
        headers: new Headers({
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36',
          'referer': 'https://x.com/post/1',
          'x-vercel-ip-country': 'US'
        })
      }
    } as any;

    await recordClick(42, event);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const ops = (prisma.$transaction as any).mock.calls[0][0];
    expect(ops).toHaveLength(2);
    // First op: click create
    expect(ops[0]).toMatchObject({
      data: {
        urlId: 42,
        referrer: 'x.com',
        country: 'US',
        browser: 'Chrome',
        device: 'desktop'
      }
    });
    // Second op: counter increment
    expect(ops[1]).toMatchObject({
      where: { id: 42 },
      data: { clickCount: { increment: 1 } }
    });
  });

  it('swallows DB errors (never throws)', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.$transaction as any).mockRejectedValueOnce(new Error('DB down'));

    const event = { request: { headers: new Headers() } } as any;
    await expect(recordClick(1, event)).resolves.toBeUndefined();
  });
});

describe('recordClick with opts', () => {
  it('writes surface/profileId/rowId when provided', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.$transaction as any).mockClear();
    const event = { request: { headers: new Headers({ 'user-agent': 'Mozilla/5.0 Chrome/120.0' }) } } as any;
    await recordClick(7, event, { surface: 'profile', profileId: 3, rowId: 11 });

    const ops = (prisma.$transaction as any).mock.calls[0][0];
    expect(ops[0]).toMatchObject({
      data: expect.objectContaining({
        urlId: 7,
        surface: 'profile',
        profileId: 3,
        rowId: 11
      })
    });
  });

  it('leaves surface/profileId/rowId as undefined when opts omitted', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.$transaction as any).mockClear();
    const event = { request: { headers: new Headers() } } as any;
    await recordClick(1, event);
    const ops = (prisma.$transaction as any).mock.calls[0][0];
    expect(ops[0].data.surface).toBeUndefined();
    expect(ops[0].data.profileId).toBeUndefined();
  });
});

describe('recordProfileView', () => {
  it('creates a ProfileView row with referrer + country', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.profileView.create as any).mockClear();
    const event = {
      request: { headers: new Headers({ referer: 'https://x.com/', 'x-vercel-ip-country': 'US' }) }
    } as any;
    await recordProfileView(42, event);
    expect(prisma.profileView.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ profileId: 42, referrer: 'x.com', country: 'US' })
    }));
  });

  it('swallows errors', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.profileView.create as any).mockRejectedValueOnce(new Error('boom'));
    const event = { request: { headers: new Headers() } } as any;
    await expect(recordProfileView(1, event)).resolves.toBeUndefined();
  });
});
