import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  const { prisma } = await import('$lib/prisma.js');
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    include: {
      rows: { orderBy: { position: 'asc' }, include: { link: { select: { shortURL: true, originalURL: true } } } }
    }
  });
  const ownedLinks = await prisma.longURL.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, shortURL: true, originalURL: true }
  });
  return { user, profile, ownedLinks };
};
