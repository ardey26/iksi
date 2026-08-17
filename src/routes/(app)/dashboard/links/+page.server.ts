import type { PageServerLoad } from './$types';
import { decodeURL } from '$lib/server/crypto.js';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  const { prisma } = await import('$lib/prisma.js');

  const [links, profile] = await Promise.all([
    prisma.longURL.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, shortURL: true, originalURL: true, clickCount: true, createdAt: true, safeVerdict: true }
    }),
    prisma.profile.findUnique({
      where: { userId: user.id },
      include: {
        rows: { orderBy: { position: 'asc' }, include: { link: { select: { shortURL: true } } } }
      }
    })
  ]);

  const decoded = await Promise.all(
    links.map(async (l) => {
      let plain: string;
      try {
        plain = await decodeURL(l.originalURL);
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(plain)) {
          console.warn(`[links] decodeURL yielded non-URL for shortURL="${l.shortURL}"`);
          plain = '';
        }
      } catch (err) {
        console.error(`[links] decodeURL threw for shortURL="${l.shortURL}"`, err);
        plain = '';
      }
      return { ...l, originalURL: plain };
    })
  );
  return { user, links: decoded, profile };
};
