import type { PageServerLoad } from './$types';
import { normalizeAvatarUrl } from '#lib/server/avatar-url.js';
import { mediaUrl } from '#lib/server/media-url.js';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  const { prisma } = await import('#lib/prisma.js');
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { displayName: true, bio: true, avatarUrl: true, backgroundUrl: true, theme: true, accent: true, publicClicks: true }
  });
  if (profile) {
    profile.avatarUrl = profile.avatarUrl ? mediaUrl(normalizeAvatarUrl(profile.avatarUrl)) : null;
    profile.backgroundUrl = mediaUrl(profile.backgroundUrl);
  }
  return { user, profile };
};
