import type { PageServerLoad } from './$types';
import { normalizeAvatarUrl } from '#lib/server/avatar-url.js';
import { mediaUrl } from '#lib/server/media-url.js';
import { readPayMethods } from '#lib/server/pay-methods.js';
import { payLabelOf } from '#lib/pay-methods.js';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  const { prisma } = await import('#lib/prisma.js');
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: {
      displayName: true,
      bio: true,
      avatarUrl: true,
      backgroundUrl: true,
      theme: true,
      accent: true,
      publicClicks: true,
      payMethods: true,
      payLabel: true
    }
  });
  if (!profile) return { user, profile: null, payments: null };
  const { payMethods, payLabel, ...rest } = profile;
  rest.avatarUrl = rest.avatarUrl ? mediaUrl(normalizeAvatarUrl(rest.avatarUrl)) : null;
  rest.backgroundUrl = mediaUrl(rest.backgroundUrl);
  return { user, profile: rest, payments: { methods: readPayMethods(payMethods), label: payLabelOf(payLabel) } };
};
