import { prisma } from '#lib/prisma.js';
import { checkURLs } from '#lib/server/safe-browsing.js';
import { waitUntil } from '@vercel/functions';
import { purgeEdge } from '#lib/server/edge-purge.js';
import { FLAGGED_VERDICTS } from '#lib/server/link-record.js';

/**
 * Check every URL a link can send a visitor to (plaintext: the default and each
 * rule and split destination) in one Safe Browsing lookup and store the worst
 * verdict, but only on the settings version that was checked: a slower check
 * of an edit that has since been superseded writes nothing, and the newer
 * edit's own check settles the link. Then quarantine profile rows if flagged
 * and purge the edge, last, so a re-fetch in between cannot cache stale state.
 */
export async function settleVerdict(
  shortURL: string,
  urls: readonly string[],
  settingsVersion: number
): Promise<void> {
  const verdict = await checkURLs(urls);
  const where =
    verdict === 'pending'
      ? {
          shortURL,
          settingsVersion,
          // An incomplete check cannot clear a flag. SQL NOT IN never matches
          // NULL, hence the explicit null branch.
          OR: [{ safeVerdict: null }, { safeVerdict: { notIn: [...FLAGGED_VERDICTS] } }]
        }
      : { shortURL, settingsVersion };
  const { count } = await prisma.longURL.updateMany({
    where,
    data: { safeVerdict: verdict, safeCheckedAt: new Date() }
  });
  if (count === 0) return;
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
export function settleVerdictInBackground(
  shortURL: string,
  urls: readonly string[],
  settingsVersion: number
): void {
  waitUntil(settleVerdict(shortURL, urls, settingsVersion).catch(() => {}));
}
