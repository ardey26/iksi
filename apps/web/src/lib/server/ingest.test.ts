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

function fakeDb(existing: number[], profiles: number[] = [], rowsIds: number[] = []) {
  const db = {
    existingLinkIds: vi.fn(async (ids: number[]) => new Set(ids.filter((i) => existing.includes(i)))),
    existingProfileIds: vi.fn(async (ids: number[]) => new Set(ids.filter((i) => profiles.includes(i)))),
    existingRowIds: vi.fn(async (ids: number[]) => new Set(ids.filter((i) => rowsIds.includes(i)))),
    writeBatch: vi.fn(async (_rows: ClickRow[], _c: Map<number, number>) => {})
  };
  return db satisfies IngestDb;
}

describe('ingestClicks', () => {
  it('inserts rows and aggregates counts per link', async () => {
    const db = fakeDb([3, 4]);
    const res = await ingestClicks([ev(3), ev(3), ev(4)], db);
    expect(res).toEqual({ accepted: 3, dropped: 0 });
    const rows = db.writeBatch.mock.calls[0][0];
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
    expect(db.writeBatch.mock.calls[0][1]).toEqual(
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
    expect(db.writeBatch.mock.calls[0][0]).toHaveLength(1);
    expect(db.writeBatch.mock.calls[0][1]).toEqual(new Map([[3, 1]]));
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
    expect(db.writeBatch).not.toHaveBeenCalled();
  });

  it('nulls deleted profile and row refs but still counts the click', async () => {
    const db = fakeDb([3], [], []);
    const res = await ingestClicks([ev(3, { surface: 'profile', profileId: 7, rowId: 9 })], db);
    expect(res).toEqual({ accepted: 1, dropped: 0 });
    expect(db.writeBatch.mock.calls[0][0][0]).toMatchObject({ profileId: null, rowId: null });
    expect(db.writeBatch.mock.calls[0][1]).toEqual(new Map([[3, 1]]));
  });

  it('keeps profile and row refs that still exist', async () => {
    const db = fakeDb([3], [7], [9]);
    await ingestClicks([ev(3, { surface: 'profile', profileId: 7, rowId: 9 })], db);
    expect(db.writeBatch.mock.calls[0][0][0]).toMatchObject({ profileId: 7, rowId: 9 });
  });

  it('drops an event whose ids exceed INT4 and still stores its batch-mates', async () => {
    // Like Postgres: an INT4 column lookup with a larger value throws for the whole query.
    const int4 = (ids: number[]) => {
      if (ids.some((i) => i > 2147483647)) throw new Error('value out of range for type integer');
    };
    const db = fakeDb([3, 4], [7], [9]);
    db.existingLinkIds.mockImplementation(async (ids) => (int4(ids), new Set(ids.filter((i) => [3, 4].includes(i)))));
    db.existingProfileIds.mockImplementation(async (ids) => (int4(ids), new Set(ids.filter((i) => i === 7))));
    db.existingRowIds.mockImplementation(async (ids) => (int4(ids), new Set(ids.filter((i) => i === 9))));
    const res = await ingestClicks(
      [
        ev(3),
        ev(3, { surface: 'profile', profileId: 3000000000, rowId: 9 }),
        ev(2147483648),
        ev(4, { surface: 'profile', profileId: 7, rowId: 2147483648 }),
        ev(4, { surface: 'profile', profileId: 7, rowId: 9 })
      ],
      db
    );
    expect(res).toEqual({ accepted: 2, dropped: 3 });
    const rows = db.writeBatch.mock.calls[0][0];
    expect(rows.map((r) => [r.urlId, r.profileId, r.rowId])).toEqual([
      [3, null, null],
      [4, 7, 9]
    ]);
  });

  it('rejects when writeBatch rejects so the batch is retried', async () => {
    const db = fakeDb([3]);
    db.writeBatch.mockRejectedValue(new Error('db down'));
    await expect(ingestClicks([ev(3)], db)).rejects.toThrow('db down');
  });
});
