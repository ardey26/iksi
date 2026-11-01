import { Prisma } from '@prisma/client';
import { FLAGGED_VERDICTS, isFlagged } from '#lib/server/link-record.js';

/**
 * Burn after reading. A one-time link holds its content (a URL or a text,
 * encrypted with encodeURL) in `secret`, never in `originalURL`, so nothing
 * that lists or checks destinations can see it. Viewing never burns it; only
 * the reveal action does, through claimOneTime.
 */

export type OneTimeState = 'flagged' | 'opened' | 'expired' | 'sealed';

/** Order matters: flagged, then opened, then expired, else sealed (still openable). */
export function oneTimeState(
  row: {
    safeVerdict: string | null;
    openedAt: Date | null;
    expiredAt: Date | null;
    expiresAt: Date | null;
  },
  now: number
): OneTimeState {
  if (isFlagged(row.safeVerdict)) return 'flagged';
  if (row.openedAt !== null) return 'opened';
  if (row.expiredAt !== null || (row.expiresAt !== null && row.expiresAt.getTime() <= now)) {
    return 'expired';
  }
  return 'sealed';
}

/**
 * Claims the link for one visitor: a single conditional UPDATE that marks it
 * opened and erases the content, so of two concurrent reveals exactly one
 * changes the row (Postgres re-checks the WHERE under the row lock). True when
 * this call won. The caller must have read the content before calling.
 */
export async function claimOneTime(
  db: { $executeRaw: (query: Prisma.Sql) => Promise<number> },
  id: number,
  now: number
): Promise<boolean> {
  const at = new Date(now);
  const affected = await db.$executeRaw(Prisma.sql`
    UPDATE "LongURL" SET "openedAt" = ${at}, "secret" = NULL
    WHERE "id" = ${id}
      AND "oneTime" = true
      AND "openedAt" IS NULL
      AND "secret" IS NOT NULL
      AND "expiredAt" IS NULL
      AND ("expiresAt" IS NULL OR "expiresAt" > ${at})
      AND ("safeVerdict" IS NULL OR "safeVerdict" NOT IN (${Prisma.join([...FLAGGED_VERDICTS])}))
  `);
  return affected === 1;
}
