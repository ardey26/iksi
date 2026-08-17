import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  const { prisma } = await import('$lib/prisma.js');
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { displayName: true, bio: true, avatarUrl: true, theme: true, accent: true, publicClicks: true }
  });
  return { user, profile };
};
