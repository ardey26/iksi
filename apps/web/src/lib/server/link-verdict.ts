import { prisma } from '#lib/prisma.js';
import { checkURLs } from '#lib/server/safe-browsing.js';
import { waitUntil } from '@vercel/functions';
import { purgeEdge } from '#lib/server/edge-purge.js';
import { FLAGGED_VERDICTS } from '#lib/server/link-record.js';

/**
 * Check every URL a link can send a visitor to (plaintext: the default and each
 * rule and split destination) in one Safe Browsing lookup, store the worst
 * verdict, quarantine any profile rows if flagged, then purge the edge cache.
 * The purge comes last so a re-fetch in between cannot cache stale state.
 */
export async function settleVerdict(shortURL: string, urls: readonly string[]): Promise<void> {
  const verdict = await checkURLs(urls);
  if (verdict === 'pending') {
    // The check did not complete, so it cannot clear a flag. SQL NOT IN never
    // matches NULL, hence the explicit null branch.
    await prisma.longURL.updateMany({
      where: {
        shortURL,
        OR: [{ safeVerdict: null }, { safeVerdict: { notIn: [...FLAGGED_VERDICTS] } }]
      },
      data: { safeVerdict: verdict, safeCheckedAt: new Date() }
    });
  } else {
    await prisma.longURL.update({
      where: { shortURL },
      data: { safeVerdict: verdict, safeCheckedAt: new Date() }
    });
  }
  if (verdict !== 'safe' && verdict !== 'pending') {
    await prisma.profileRow.updateMany({
      where: { link: { shortURL } },
      data: { quarantined: true }
    });
  }
  await purgeEdge([shortURL]);
}

/**
 * Run settleVerdict past the response. waitUntil keeps the Vercel function
 * alive until it finishes (a no-op outside a Vercel request). Never rejects.
 */
export function settleVerdictInBackground(shortURL: string, urls: readonly string[]): void {
  waitUntil(settleVerdict(shortURL, urls).catch(() => {}));
}
