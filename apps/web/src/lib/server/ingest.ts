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
  existingProfileIds(ids: number[]): Promise<Set<number>>;
  existingRowIds(ids: number[]): Promise<Set<number>>;
  /** Must insert the rows and apply the counts atomically. */
  writeBatch(rows: ClickRow[], counts: Map<number, number>): Promise<void>;
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

  const profileIds = [...new Set(live.flatMap((e) => (e.profileId == null ? [] : [e.profileId])))];
  const rowIds = [...new Set(live.flatMap((e) => (e.rowId == null ? [] : [e.rowId])))];
  const [profiles, profileRows] = await Promise.all([
    profileIds.length ? db.existingProfileIds(profileIds) : new Set<number>(),
    rowIds.length ? db.existingRowIds(rowIds) : new Set<number>()
  ]);

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
      // Referenced profile/row may have been deleted since the redirect; keep the click.
      profileId: e.profileId != null && profiles.has(e.profileId) ? e.profileId : null,
      rowId: e.rowId != null && profileRows.has(e.rowId) ? e.rowId : null
    };
  });
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.urlId, (counts.get(r.urlId) ?? 0) + 1);

  await db.writeBatch(rows, counts);
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
    async existingProfileIds(ids) {
      const found = await prisma.profile.findMany({
        where: { id: { in: ids } },
        select: { id: true }
      });
      return new Set(found.map((f) => f.id));
    },
    async existingRowIds(ids) {
      const found = await prisma.profileRow.findMany({
        where: { id: { in: ids } },
        select: { id: true }
      });
      return new Set(found.map((f) => f.id));
    },
    async writeBatch(rows, counts) {
      // updateMany tolerates links deleted after the existence check.
      await prisma.$transaction([
        prisma.click.createMany({ data: rows }),
        ...[...counts].map(([id, n]) =>
          prisma.longURL.updateMany({ where: { id }, data: { clickCount: { increment: n } } })
        )
      ]);
    }
  };
}
