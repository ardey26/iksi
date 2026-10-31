import { parseClickEvent } from '@iksi/core';
import type { PrismaClient } from '@prisma/client';
import { parseUA, normalizeReferrer } from '#lib/server/tracking.js';

export interface IngestResult {
  accepted: number;
  dropped: number;
}

export interface ClickRow {
  urlId: number;
  createdAt: Date;
  referrer: string | null;
  country: string | null;
  browser: string;
  device: string;
  surface: string;
  profileId: number | null;
  rowId: number | null;
}

export interface IngestDb {
  existingLinkIds(ids: number[]): Promise<Set<number>>;
  insertClicks(rows: ClickRow[]): Promise<void>;
  incrementClickCounts(counts: Map<number, number>): Promise<void>;
}

export async function ingestClicks(raw: unknown[], db: IngestDb): Promise<IngestResult> {
  const events = raw.flatMap((r) => {
    const e = parseClickEvent(r);
    return e ? [e] : [];
  });
  if (events.length === 0) return { accepted: 0, dropped: raw.length };

  const existing = await db.existingLinkIds([...new Set(events.map((e) => e.linkId))]);
  const live = events.filter((e) => existing.has(e.linkId));
  if (live.length === 0) return { accepted: 0, dropped: raw.length };

  const rows: ClickRow[] = live.map((e) => {
    const { browser, device } = parseUA(e.userAgent);
    return {
      urlId: e.linkId,
      createdAt: new Date(e.ts),
      referrer: normalizeReferrer(e.referer),
      country: e.country,
      browser,
      device,
      surface: e.surface,
      profileId: e.profileId,
      rowId: e.rowId
    };
  });
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.urlId, (counts.get(r.urlId) ?? 0) + 1);

  await db.insertClicks(rows);
  await db.incrementClickCounts(counts);
  return { accepted: rows.length, dropped: raw.length - rows.length };
}

export function prismaIngestDb(prisma: PrismaClient): IngestDb {
  return {
    async existingLinkIds(ids) {
      const found = await prisma.longURL.findMany({
        where: { id: { in: ids } },
        select: { id: true }
      });
      return new Set(found.map((f) => f.id));
    },
    async insertClicks(rows) {
      await prisma.click.createMany({ data: rows });
    },
    async incrementClickCounts(counts) {
      await prisma.$transaction(
        [...counts].map(([id, n]) =>
          prisma.longURL.update({ where: { id }, data: { clickCount: { increment: n } } })
        )
      );
    }
  };
}
