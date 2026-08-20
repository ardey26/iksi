import type { PageServerLoad } from './$types';
import { decodeURL } from '$lib/server/crypto.js';

// Cap the initial dashboard load. Fetching + decoding every link a user has
// ever created scales linearly with account age; on top of that, any
// legacy-format URLs get scrypt-decoded here, which is intentionally slow
// (~100-500ms each). Show the most recent N and expose a total count so
// the UI can offer "load more" cursor pagination if needed.
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export const load: PageServerLoad = async ({ parent, url }) => {
  const { user } = await parent();
  const { prisma } = await import('$lib/prisma.js');

  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Number.isInteger(limitParam) && limitParam > 0 && limitParam <= MAX_LIMIT
    ? limitParam
    : DEFAULT_LIMIT;

  // profileId is provided by the cached root layout payload — no extra
  // query needed. Then fire the link list and total count in parallel.
  const profileId = user.profileId;

  const [links, totalCount] = await Promise.all([
    prisma.longURL.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        shortURL: true,
        originalURL: true,
        clickCount: true,
        createdAt: true,
        safeVerdict: true,
        profileRows: profileId
          ? {
              where: { profileId },
              select: { id: true, title: true, enabled: true, position: true },
              take: 1
            }
          : false
      }
    }),
    prisma.longURL.count({ where: { userId: user.id } })
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

  return {
    user,
    links: decoded,
    totalCount,
    limit,
    hasMore: totalCount > limit
  };
};
