import { prisma } from '#lib/prisma.js';
import { checkURL } from '#lib/server/safe-browsing.js';
import { purgeEdge } from '#lib/server/edge-purge.js';

/**
 * Check a freshly created link with Safe Browsing, store the verdict,
 * quarantine any profile rows if flagged, then purge the edge cache. The
 * purge comes last so a re-fetch in between cannot cache stale state.
 */
export async function settleVerdict(shortURL: string, prefixedURL: string): Promise<void> {
  const verdict = await checkURL(prefixedURL);
  await prisma.longURL.update({
    where: { shortURL },
    data: { safeVerdict: verdict, safeCheckedAt: new Date() }
  });
  if (verdict !== 'safe' && verdict !== 'pending') {
    await prisma.profileRow.updateMany({
      where: { link: { shortURL } },
      data: { quarantined: true }
    });
  }
  await purgeEdge([shortURL]);
}
