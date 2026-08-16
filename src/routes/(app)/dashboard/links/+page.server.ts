import type { PageServerLoad } from './$types';
import { decodeURL } from '$lib/server/crypto.js';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  const { prisma } = await import('$lib/prisma.js');
  const links = await prisma.longURL.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, shortURL: true, originalURL: true, clickCount: true, createdAt: true, safeVerdict: true }
  });
  const decoded = await Promise.all(links.map(async l => ({ ...l, originalURL: await decodeURL(l.originalURL) })));
  return { user, links: decoded };
};
