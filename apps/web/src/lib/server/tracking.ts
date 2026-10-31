import type { RequestEvent } from '@sveltejs/kit';
import { parseUserAgent, referrerHost } from '@iksi/core';
import { waitUntil } from '@vercel/functions';
import { clientOf } from '#lib/server/client.js';
import { purgeEdge } from '#lib/server/edge-purge.js';

export type UAInfo = { browser: string; device: string };

export function parseUA(ua: string | null | undefined): UAInfo {
  const { browser, device } = parseUserAgent(ua ?? null);
  return { browser, device };
}

export function normalizeReferrer(referer: string | null | undefined): string | null {
  return referrerHost(referer ?? null);
}

export async function recordClick(
  urlId: number,
  event: RequestEvent,
  opts?: { surface?: 'direct' | 'profile' | 'api'; profileId?: number; rowId?: number }
): Promise<void> {
  try {
    // Dynamic import: vi.mock hoisting is not reliable through SvelteKit's $lib alias,
    // and dynamic import lets the test-time mock replace the module registry entry.
    const { prisma } = await import('#lib/prisma.js');
    const h = event.request.headers;
    const { browser, device } = parseUA(h.get('user-agent'));
    const referrer = normalizeReferrer(h.get('referer'));
    const { country } = clientOf(event);

    // Two independent writes, no transaction wrapper. Losing a click row
    // or a count increment on an isolated failure is fine — these are
    // analytics, not billing. Skipping the transaction halves the round
    // trips to Postgres and removes lock contention between the Click
    // insert and the LongURL row update on hot links.
    const [, link] = await Promise.all([
      prisma.click.create({
        data: {
          urlId,
          referrer,
          country,
          browser,
          device,
          surface: opts?.surface,
          profileId: opts?.profileId,
          rowId: opts?.rowId
        }
      }),
      prisma.longURL.update({
        where: { id: urlId },
        data: { clickCount: { increment: 1 } },
        select: { shortURL: true, clickCount: true, maxClicks: true }
      })
    ]);
    // An origin click never reaches queue ingest, which is what purges a link
    // at its cap, so the edge could keep redirecting from its cached record.
    // Exactly equal: only the click that reaches the cap purges.
    if (link?.maxClicks != null && link.clickCount === link.maxClicks) {
      waitUntil(purgeEdge([link.shortURL]).catch(() => {}));
    }
  } catch (err) {
    console.error('recordClick failed', err);
  }
}

export async function recordProfileView(profileId: number, event: RequestEvent): Promise<void> {
  try {
    const { prisma } = await import('#lib/prisma.js');
    const h = event.request.headers;
    const referrer = normalizeReferrer(h.get('referer'));
    const { country } = clientOf(event);
    await prisma.profileView.create({ data: { profileId, referrer, country } });
  } catch (err) {
    console.error('recordProfileView failed', err);
  }
}
