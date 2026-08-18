import type { PageServerLoad } from './$types';
import { decodeURL } from '$lib/server/crypto.js';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  const { prisma } = await import('$lib/prisma.js');

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { id: true }
  });

  const links = await prisma.longURL.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      shortURL: true,
      originalURL: true,
      clickCount: true,
      createdAt: true,
      safeVerdict: true,
      profileRows: profile
        ? {
            where: { profileId: profile.id },
            select: { id: true, title: true, enabled: true, position: true },
            take: 1
          }
        : false
    }
  });

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
      const row = (l as any).profileRows?.[0] ?? null;
      const { profileRows: _drop, ...rest } = l as any;
      return { ...rest, originalURL: plain, profileRow: row };
    })
  );

  // Sort: public rows first (by their configured position), then everything
  // else by recency. Matches the order of the public page for on-page items.
  decoded.sort((a, b) => {
    const aPos = a.profileRow?.position ?? Number.POSITIVE_INFINITY;
    const bPos = b.profileRow?.position ?? Number.POSITIVE_INFINITY;
    if (aPos !== bPos) return aPos - bPos;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return { user, links: decoded };
};
