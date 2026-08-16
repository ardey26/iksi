import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    longURL: { count: vi.fn() },
    click: { count: vi.fn() }
  }
}));

import { getKPIs, getTimeSeries } from './stats';

describe('getKPIs', () => {
  it('returns 4 counts (totals + today) with bots excluded from click counts', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.longURL.count as any).mockResolvedValueOnce(100); // totalURLs
    (prisma.longURL.count as any).mockResolvedValueOnce(5);   // todayURLs
    (prisma.click.count as any).mockResolvedValueOnce(9000);  // totalClicks (no-bot)
    (prisma.click.count as any).mockResolvedValueOnce(42);    // todayClicks (no-bot)

    const kpi = await getKPIs();

    expect(kpi).toEqual({
      totalURLs: 100,
      todayURLs: 5,
      totalClicks: 9000,
      todayClicks: 42
    });

    const clickCalls = (prisma.click.count as any).mock.calls;
    expect(clickCalls[0][0]).toMatchObject({ where: { NOT: { device: 'bot' } } });
    expect(clickCalls[1][0].where).toMatchObject({ NOT: { device: 'bot' } });
    expect(clickCalls[1][0].where.createdAt).toBeDefined();
  });
});

describe('getTimeSeries', () => {
  it('zero-fills missing days and returns aligned arrays', async () => {
    const { prisma } = await import('$lib/prisma.js');
    const urlsRows = [
      { day: new Date('2026-08-10T00:00:00Z'), count: 2 }
    ];
    const clicksRows = [
      { day: new Date('2026-08-11T00:00:00Z'), count: 7 }
    ];
    (prisma.$queryRaw as any)
      .mockResolvedValueOnce(urlsRows)
      .mockResolvedValueOnce(clicksRows);

    const series = await getTimeSeries({
      days: 3,
      endDate: new Date('2026-08-11T12:00:00Z'),
      includeBots: false
    });

    expect(series.labels).toHaveLength(3);
    expect(series.urls).toEqual([0, 2, 0]);
    expect(series.clicks).toEqual([0, 0, 7]);
  });
});

import { getTopLinks, getCountryBreakdown } from './stats';

describe('getTopLinks', () => {
  it('returns rows sorted by clickCount desc, limit 20', async () => {
    const { prisma } = await import('$lib/prisma.js');
    const rows = [
      { shortURL: 'abc', originalURL: 'https://a.com', clickCount: 100, createdAt: new Date('2026-01-01') },
      { shortURL: 'def', originalURL: 'https://d.com', clickCount: 50,  createdAt: new Date('2026-02-01') }
    ];
    (prisma.$queryRaw as any).mockResolvedValueOnce(rows);

    const top = await getTopLinks({ sort: 'clicks' });

    expect(top).toEqual(rows);
    const sqlCall = (prisma.$queryRaw as any).mock.calls.at(-1)[0];
    const sql = sqlCall.strings.join('?');
    expect(sql).toMatch(/ORDER BY "clickCount" DESC/);
    expect(sql).toMatch(/LIMIT 20/);
  });

  it('sorts by createdAt when requested', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.$queryRaw as any).mockResolvedValueOnce([]);
    await getTopLinks({ sort: 'created' });
    const sqlCall = (prisma.$queryRaw as any).mock.calls.at(-1)[0];
    const sql = sqlCall.strings.join('?');
    expect(sql).toMatch(/ORDER BY "createdAt" DESC/);
  });
});

describe('getCountryBreakdown', () => {
  it('returns top rows plus an "Other" bucket for the remainder', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([
        { country: 'US', count: 100 },
        { country: 'PH', count: 50 }
      ])
      .mockResolvedValueOnce([{ count: 25 }]);

    const rows = await getCountryBreakdown({ includeBots: false });

    expect(rows).toEqual([
      { country: 'US', count: 100 },
      { country: 'PH', count: 50 },
      { country: null, count: 25, isOther: true }
    ]);
  });
});

import { getReferrerBreakdown } from './stats';

describe('getReferrerBreakdown', () => {
  it('returns top hosts and a Direct bucket for null referrers', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([
        { referrer: 'x.com', count: 80 },
        { referrer: 'google.com', count: 40 }
      ])
      .mockResolvedValueOnce([{ count: 15 }]);

    const rows = await getReferrerBreakdown({ includeBots: false });
    expect(rows).toEqual([
      { referrer: 'x.com', count: 80 },
      { referrer: 'google.com', count: 40 },
      { referrer: null, count: 15, isDirect: true }
    ]);
  });
});

import { getUABreakdown } from './stats';

describe('getUABreakdown', () => {
  it('returns browser and device buckets', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([{ browser: 'Chrome', count: 100 }, { browser: 'Safari', count: 30 }])
      .mockResolvedValueOnce([{ device: 'desktop', count: 90 }, { device: 'mobile', count: 40 }]);

    const out = await getUABreakdown({ includeBots: false });
    expect(out.browsers).toEqual([{ browser: 'Chrome', count: 100 }, { browser: 'Safari', count: 30 }]);
    expect(out.devices).toEqual([{ device: 'desktop', count: 90 }, { device: 'mobile', count: 40 }]);
  });
});

import { getProfileStats, getProfileTimeSeries } from './stats';

describe('getProfileStats', () => {
  it('returns views, clicks, ctr, rowClicks with bot exclusion', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.$queryRaw as any).mockResolvedValueOnce([{ count: 100 }]); // views
    (prisma.$queryRaw as any).mockResolvedValueOnce([{ count: 25 }]);  // clicks
    (prisma.$queryRaw as any).mockResolvedValueOnce([
      { rowId: 1, count: 15 },
      { rowId: 2, count: 10 }
    ]);

    const s = await getProfileStats(42, { includeBots: false });
    expect(s).toEqual({
      views: 100,
      clicks: 25,
      ctr: 0.25,
      rowClicks: [ { rowId: 1, count: 15 }, { rowId: 2, count: 10 } ]
    });
  });

  it('ctr is 0 when views is 0', async () => {
    const { prisma } = await import('$lib/prisma.js');
    (prisma.$queryRaw as any).mockResolvedValueOnce([{ count: 0 }]);
    (prisma.$queryRaw as any).mockResolvedValueOnce([{ count: 0 }]);
    (prisma.$queryRaw as any).mockResolvedValueOnce([]);
    const s = await getProfileStats(1, { includeBots: false });
    expect(s.ctr).toBe(0);
  });
});

describe('getProfileTimeSeries', () => {
  it('returns aligned labels, views, clicks arrays for the window', async () => {
    const { prisma } = await import('$lib/prisma.js');
    const end = new Date('2026-08-16T12:00:00Z');
    (prisma.$queryRaw as any).mockResolvedValueOnce([
      { day: new Date('2026-08-15T00:00:00Z'), count: 5 }
    ]);
    (prisma.$queryRaw as any).mockResolvedValueOnce([
      { day: new Date('2026-08-16T00:00:00Z'), count: 2 }
    ]);
    const s = await getProfileTimeSeries(1, { days: 3 as any, endDate: end });
    expect(s.labels).toHaveLength(3);
    expect(s.views).toEqual([0, 5, 0]);
    expect(s.clicks).toEqual([0, 0, 2]);
  });
});
