import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkURLs } from '#lib/server/safe-browsing.js';
import { purgeEdge } from '#lib/server/edge-purge.js';
import { destinationsOf } from '#lib/server/link-record.js';

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
    select: { id: true, originalURL: true, shortURL: true, safeVerdict: true, rules: true }
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
      await prisma.longURL.update({ where: { id: l.id }, data: { safeVerdict: verdict, safeCheckedAt: new Date() } });
      await prisma.profileRow.updateMany({
        where: { linkId: l.id },
        data: { quarantined: verdict !== 'safe' && verdict !== 'pending' }
      });
      if (verdict !== l.safeVerdict) changed.push(l.shortURL);
      if (changed.length >= 50) await flush();
      checked++;
      if (checked >= 500) break;
    }
  } finally {
    await flush();
  }

  return json({ checked });
};
