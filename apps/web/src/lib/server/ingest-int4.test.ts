import { describe, it, expect, vi } from 'vitest';

// Defence in depth: even if the shared parser ever lets an oversized id through,
// ingest itself must drop the event rather than hand Postgres an INT4 overflow.
vi.mock('@iksi/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@iksi/core')>();
  return { ...real, parseClickEvent: (r: unknown) => r as never };
});

import { ingestClicks, type ClickRow, type IngestDb } from './ingest';

const ev = (linkId: number, profileId: number | null = null, rowId: number | null = null) => ({
  v: 1,
  linkId,
  ts: 1_700_000_000_000,
  country: null,
  userAgent: null,
  referer: null,
  surface: profileId === null ? 'direct' : 'profile',
  profileId,
  rowId
});

describe('ingestClicks INT4 guard', () => {
  it('drops events with out-of-range ids before any lookup', async () => {
    const seen: number[][] = [];
    const lookup = vi.fn(async (ids: number[]) => {
      seen.push(ids);
      return new Set(ids);
    });
    const db: IngestDb = {
      existingLinkIds: lookup,
      existingProfileIds: lookup,
      existingRowIds: lookup,
      writeBatch: vi.fn(async (_r: ClickRow[], _c: Map<number, number>) => {})
    };
    const res = await ingestClicks(
      [ev(3), ev(2147483648), ev(3, 2147483648, 1), ev(3, 1, 2147483648), ev(2147483647, 1, 2)],
      db
    );
    expect(res).toEqual({ accepted: 2, dropped: 3 });
    expect(seen.flat().every((id) => id <= 2147483647)).toBe(true);
  });
});
