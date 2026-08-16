import { Prisma } from '@prisma/client';

export type KPIs = {
  totalURLs: number;
  todayURLs: number;
  totalClicks: number;
  todayClicks: number;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getKPIs(): Promise<KPIs> {
  const { prisma } = await import('$lib/prisma.js');
  const today = startOfToday();
  const noBots = { NOT: { device: 'bot' } };

  const [totalURLs, todayURLs, totalClicks, todayClicks] = await Promise.all([
    prisma.longURL.count(),
    prisma.longURL.count({ where: { createdAt: { gte: today } } }),
    prisma.click.count({ where: noBots }),
    prisma.click.count({ where: { ...noBots, createdAt: { gte: today } } })
  ]);

  return { totalURLs, todayURLs, totalClicks, todayClicks };
}

export type TimeSeries = {
  labels: string[];   // YYYY-MM-DD, oldest first
  urls: number[];
  clicks: number[];
};

export type TimeSeriesOpts = {
  days: number;
  endDate?: Date;
  includeBots?: boolean;
};

export async function getTimeSeries(opts: TimeSeriesOpts): Promise<TimeSeries> {
  const { prisma } = await import('$lib/prisma.js');
  const end = opts.endDate ?? new Date();
  // Truncate to UTC midnight to avoid timezone-sensitive behavior
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const start = new Date(endDay);
  start.setUTCDate(start.getUTCDate() - (opts.days - 1));

  const botFilter = opts.includeBots
    ? Prisma.empty
    : Prisma.sql`AND "device" IS DISTINCT FROM 'bot'`;

  // URLs created per day
  const urlsRows = await prisma.$queryRaw<Array<{ day: Date; count: number }>>`
    SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::int AS count
    FROM "LongURL"
    WHERE "createdAt" >= ${start} AND "createdAt" < ${new Date(endDay.getTime() + 86400000)}
    GROUP BY day
    ORDER BY day
  `;

  // Clicks per day (bot-filtered by default)
  const clicksRows = await prisma.$queryRaw<Array<{ day: Date; count: number }>>`
    SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::int AS count
    FROM "Click"
    WHERE "createdAt" >= ${start} AND "createdAt" < ${new Date(endDay.getTime() + 86400000)}
    ${botFilter}
    GROUP BY day
    ORDER BY day
  `;

  const urlsMap = new Map(urlsRows.map(r => [dayKey(r.day), r.count]));
  const clicksMap = new Map(clicksRows.map(r => [dayKey(r.day), r.count]));

  const labels: string[] = [];
  const urls: number[] = [];
  const clicks: number[] = [];
  for (let i = 0; i < opts.days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const k = dayKey(d);
    labels.push(k);
    urls.push(urlsMap.get(k) ?? 0);
    clicks.push(clicksMap.get(k) ?? 0);
  }

  return { labels, urls, clicks };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type TopLink = {
  shortURL: string;
  originalURL: string;
  clickCount: number;
  createdAt: Date;
};

export type TopLinksOpts = { sort: 'clicks' | 'created' };

export async function getTopLinks(opts: TopLinksOpts): Promise<TopLink[]> {
  const { prisma } = await import('$lib/prisma.js');
  if (opts.sort === 'created') {
    return prisma.$queryRaw<TopLink[]>(Prisma.sql`
      SELECT "shortURL", "originalURL", "clickCount", "createdAt"
      FROM "LongURL"
      ORDER BY "createdAt" DESC
      LIMIT 20
    `);
  }
  return prisma.$queryRaw<TopLink[]>(Prisma.sql`
    SELECT "shortURL", "originalURL", "clickCount", "createdAt"
    FROM "LongURL"
    ORDER BY "clickCount" DESC
    LIMIT 20
  `);
}

export type ReferrerRow = { referrer: string | null; count: number; isDirect?: boolean };

export async function getReferrerBreakdown(opts: { includeBots: boolean }): Promise<ReferrerRow[]> {
  const { prisma } = await import('$lib/prisma.js');
  const botFilter = opts.includeBots ? Prisma.empty : Prisma.sql`AND "device" IS DISTINCT FROM 'bot'`;

  const top = await prisma.$queryRaw<Array<{ referrer: string; count: number }>>(Prisma.sql`
    SELECT "referrer", COUNT(*)::int AS count
    FROM "Click"
    WHERE "referrer" IS NOT NULL ${botFilter}
    GROUP BY "referrer"
    ORDER BY count DESC
    LIMIT 10
  `);

  const direct = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM "Click"
    WHERE "referrer" IS NULL ${botFilter}
  `);

  const rows: ReferrerRow[] = top.map(r => ({ referrer: r.referrer, count: r.count }));
  const d = direct[0]?.count ?? 0;
  if (d > 0) rows.push({ referrer: null, count: d, isDirect: true });
  return rows;
}

export type CountryRow = { country: string | null; count: number; isOther?: boolean };

export async function getCountryBreakdown(opts: { includeBots: boolean }): Promise<CountryRow[]> {
  const { prisma } = await import('$lib/prisma.js');
  const botFilter = opts.includeBots ? Prisma.empty : Prisma.sql`AND "device" IS DISTINCT FROM 'bot'`;

  const top = await prisma.$queryRaw<Array<{ country: string | null; count: number }>>(Prisma.sql`
    SELECT "country", COUNT(*)::int AS count
    FROM "Click"
    WHERE 1=1 ${botFilter}
    GROUP BY "country"
    ORDER BY count DESC
    LIMIT 10
  `);

  const other = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM "Click"
    WHERE 1=1 ${botFilter}
      AND ("country" NOT IN (
        SELECT "country"
        FROM "Click"
        WHERE 1=1 ${botFilter}
        GROUP BY "country"
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) OR ("country" IS NULL AND FALSE))
  `);

  const rows: CountryRow[] = top.map(r => ({ country: r.country, count: r.count }));
  const otherCount = other[0]?.count ?? 0;
  if (otherCount > 0) rows.push({ country: null, count: otherCount, isOther: true });
  return rows;
}

export type UABreakdown = {
  browsers: Array<{ browser: string | null; count: number }>;
  devices: Array<{ device: string | null; count: number }>;
};

export async function getUABreakdown(opts: { includeBots: boolean }): Promise<UABreakdown> {
  const { prisma } = await import('$lib/prisma.js');
  const botFilter = opts.includeBots ? Prisma.empty : Prisma.sql`AND "device" IS DISTINCT FROM 'bot'`;

  const browsers = await prisma.$queryRaw<Array<{ browser: string | null; count: number }>>(Prisma.sql`
    SELECT "browser", COUNT(*)::int AS count
    FROM "Click"
    WHERE 1=1 ${botFilter}
    GROUP BY "browser"
    ORDER BY count DESC
  `);

  const devices = await prisma.$queryRaw<Array<{ device: string | null; count: number }>>(Prisma.sql`
    SELECT "device", COUNT(*)::int AS count
    FROM "Click"
    GROUP BY "device"
    ORDER BY count DESC
  `);

  return { browsers, devices };
}
