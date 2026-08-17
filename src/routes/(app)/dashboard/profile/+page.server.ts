import type { PageServerLoad } from './$types';
import { normalizeAvatarUrl } from '$lib/server/avatar-url';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  const { prisma } = await import('$lib/prisma.js');
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { displayName: true, bio: true, avatarUrl: true, theme: true, accent: true, publicClicks: true }
  });
  if (profile?.avatarUrl) profile.avatarUrl = normalizeAvatarUrl(profile.avatarUrl);
  return { user, profile };
};
