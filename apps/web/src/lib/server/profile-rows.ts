/**
 * Which of a profile's rows the public sees. The single source for the public
 * profile page and /api/me/profile, so both always list the same rows.
 */

/** Prisma `where` for a profile's rows: switched on, and not held by moderation. */
export const PUBLIC_ROW_WHERE = { enabled: true, quarantined: false } as const;

/**
 * A one-time link opens once, so listing it publicly would let the first
 * visitor burn it. The dashboard refuses to add one; this covers any row that
 * points at one anyway.
 */
export function publicRows<T extends { link: { oneTime: boolean } | null }>(rows: T[]): T[] {
  return rows.filter((r) => !r.link?.oneTime);
}
