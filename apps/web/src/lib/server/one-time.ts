import { Prisma } from '@prisma/client';
import { isHttpUrl, MAX_URL_LENGTH } from '@iksi/core';
import { blockedVerdict, FLAGGED_VERDICTS } from '#lib/server/link-record.js';
import { ONE_TIME_TEXT_MAX, type OneTimeKind } from '#lib/one-time.js';
import { PASSWORD_MIN, PASSWORD_MAX } from '#lib/password-limits.js';
import { addPrefix, isValidURLServer } from '#lib/utils/urlValidation.js';

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
    moderation?: string | null;
    openedAt: Date | null;
    expiredAt: Date | null;
    expiresAt: Date | null;
  },
  now: number
): OneTimeState {
  if (blockedVerdict(row) !== null) return 'flagged';
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
      AND "moderation" IS NULL
  `);
  return affected === 1;
}

export type OneTimeInput =
  | { ok: true; kind: OneTimeKind; content: string; password: string | null }
  | { ok: false; error: string };

const bad = (error: string): OneTimeInput => ({ ok: false, error });

/** Validates `{ kind, content, password? }` from a create request. A text is kept byte for byte. */
export function parseOneTimeInput(input: unknown): OneTimeInput {
  if (typeof input !== 'object' || input === null) return bad('Invalid input');
  const { kind, content, password } = input as Record<string, unknown>;
  if (kind !== 'url' && kind !== 'text') return bad('Choose a URL or a text');
  if (typeof content !== 'string') return bad('Invalid input');

  let value: string;
  if (kind === 'text') {
    if (content.trim() === '') return bad('Enter the text to share');
    if (content.length > ONE_TIME_TEXT_MAX) {
      return bad(`Text is too long (max ${ONE_TIME_TEXT_MAX.toLocaleString('en-US')} characters)`);
    }
    value = content;
  } else {
    if (content.trim() === '') return bad('Enter a valid URL');
    value = addPrefix(content);
    if (value.length > MAX_URL_LENGTH) return bad(`URL is too long (max ${MAX_URL_LENGTH} characters)`);
    if (!isValidURLServer(value) || !isHttpUrl(value)) return bad('Enter a valid URL');
  }

  if (password === undefined || password === null || password === '') {
    return { ok: true, kind, content: value, password: null };
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return bad(`Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`);
  }
  return { ok: true, kind, content: value, password };
}
