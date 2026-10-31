import { describe, it, expect, vi } from 'vitest';
import { ingestClicks, type IngestDb, type ClickRow } from './ingest';

function ev(linkId: number, over: Record<string, unknown> = {}) {
  return {
    v: 1,
    linkId,
    ts: 1_700_000_000_000,
    country: 'PH',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36',
    referer: 'https://www.example.com/page',
    surface: 'direct',
    profileId: null,
    rowId: null,
    ...over
  };
}

function fakeDb(existing: number[]) {
  const db = {
    existingLinkIds: vi.fn(async (ids: number[]) => new Set(ids.filter((i) => existing.includes(i)))),
    insertClicks: vi.fn(async (_rows: ClickRow[]) => {}),
    incrementClickCounts: vi.fn(async (_c: Map<number, number>) => {})
  };
  return db satisfies IngestDb;
}

describe('ingestClicks', () => {
  it('inserts rows and aggregates counts per link', async () => {
    const db = fakeDb([3, 4]);
    const res = await ingestClicks([ev(3), ev(3), ev(4)], db);
    expect(res).toEqual({ accepted: 3, dropped: 0 });
    const rows = db.insertClicks.mock.calls[0][0];
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      urlId: 3,
      browser: 'Chrome',
      device: 'desktop',
      referrer: 'example.com',
      country: 'PH',
      surface: 'direct',
      profileId: null,
      rowId: null
    });
    expect(rows[0].createdAt).toEqual(new Date(1_700_000_000_000));
    expect(db.incrementClickCounts).toHaveBeenCalledWith(
      new Map([
        [3, 2],
        [4, 1]
      ])
    );
  });

  it('drops events for links that no longer exist', async () => {
    const db = fakeDb([3]);
    const res = await ingestClicks([ev(99), ev(3)], db);
    expect(res).toEqual({ accepted: 1, dropped: 1 });
    expect(db.insertClicks.mock.calls[0][0]).toHaveLength(1);
    expect(db.incrementClickCounts).toHaveBeenCalledWith(new Map([[3, 1]]));
  });

  it('drops malformed events without throwing', async () => {
    const db = fakeDb([3]);
    const res = await ingestClicks([{ v: 2 }, null, ev(3)], db);
    expect(res).toEqual({ accepted: 1, dropped: 2 });
  });

  it('makes no db calls for empty or all-invalid input', async () => {
    const db = fakeDb([]);
    expect(await ingestClicks([], db)).toEqual({ accepted: 0, dropped: 0 });
    expect(await ingestClicks([null], db)).toEqual({ accepted: 0, dropped: 1 });
    expect(db.existingLinkIds).not.toHaveBeenCalled();
    expect(db.insertClicks).not.toHaveBeenCalled();
    expect(db.incrementClickCounts).not.toHaveBeenCalled();
  });
});
