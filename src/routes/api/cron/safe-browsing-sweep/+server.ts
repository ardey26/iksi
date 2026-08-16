import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkURL } from '$lib/server/safe-browsing';

export const GET: RequestHandler = async ({ request }) => {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorized', { status: 401 });

  const { prisma } = await import('$lib/prisma.js');
  const { decodeURL } = await import('$lib/server/crypto.js');
  const cutoff = new Date(Date.now() - 86400000);

  const links = await prisma.longURL.findMany({
    where: {
      OR: [
        { safeCheckedAt: null },
        { safeCheckedAt: { lt: cutoff } }
      ],
      profileRows: { some: { enabled: true } }
    },
    select: { id: true, originalURL: true }
  });

  let checked = 0;
  for (const l of links) {
    const raw = await decodeURL(l.originalURL);
    const verdict = await checkURL(raw);
    await prisma.longURL.update({ where: { id: l.id }, data: { safeVerdict: verdict, safeCheckedAt: new Date() } });
    await prisma.profileRow.updateMany({
      where: { linkId: l.id },
      data: { quarantined: verdict !== 'safe' && verdict !== 'pending' }
    });
    checked++;
    if (checked >= 500) break;
  }

  return json({ checked });
};
