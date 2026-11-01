import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkURLs } from '#lib/server/safe-browsing.js';
import { purgeEdge } from '#lib/server/edge-purge.js';
import { destinationsOf, isFlagged } from '#lib/server/link-record.js';

export const GET: RequestHandler = async ({ request }) => {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorized', { status: 401 });

  const { prisma } = await import('#lib/prisma.js');
  const { decodeURL } = await import('#lib/server/crypto.js');
  const cutoff = new Date(Date.now() - 86400000);

  const links = await prisma.longURL.findMany({
    where: {
      OR: [
        { safeCheckedAt: null },
        { safeCheckedAt: { lt: cutoff } }
      ],
      profileRows: { some: { enabled: true } }
    },
    select: { id: true, originalURL: true, shortURL: true, safeVerdict: true, rules: true, settingsVersion: true, moderation: true }
  });

  let checked = 0;
  let changed: string[] = [];
  const flush = async () => {
    if (!changed.length) return;
    const batch = changed;
    changed = [];
    await purgeEdge(batch);
  };
  try {
    for (const l of links) {
      const raw = await decodeURL(l.originalURL);
      // Rule and split destinations redirect too; one lookup covers them all.
      const verdict = await checkURLs(destinationsOf(raw, l.rules));
      // An incomplete check keeps an existing flag and its quarantine; retried next run.
      const keepFlag = verdict === 'pending' && isFlagged(l.safeVerdict);
      // Rows are read up front: one edited since then is settled by its own check.
      const written = keepFlag
        ? 0
        : (
            await prisma.longURL.updateMany({
              where: { id: l.id, settingsVersion: l.settingsVersion },
              data: { safeVerdict: verdict, safeCheckedAt: new Date() }
            })
          ).count;
      if (written > 0) {
        await prisma.profileRow.updateMany({
          where: { linkId: l.id },
          // A link held for review or disabled stays off profiles whatever Safe Browsing says.
          data: { quarantined: (verdict !== 'safe' && verdict !== 'pending') || l.moderation != null }
        });
        if (verdict !== l.safeVerdict) changed.push(l.shortURL);
        if (changed.length >= 50) await flush();
      }
      checked++;
      if (checked >= 500) break;
    }
  } finally {
    await flush();
  }

  return json({ checked });
};
