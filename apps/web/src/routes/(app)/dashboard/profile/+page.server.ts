import type { PageServerLoad } from './$types';
import { normalizeAvatarUrl } from '#lib/server/avatar-url.js';
import { mediaUrl } from '#lib/server/media-url.js';
import { readPayMethods } from '#lib/server/pay-methods.js';
import { payLabelOf } from '#lib/pay-methods.js';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  const { prisma } = await import('#lib/prisma.js');
  const [profile, account] = await Promise.all([
    prisma.profile.findUnique({
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
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { scopeCustomNames: true } })
  ]);
  const scopeCustomNames = account?.scopeCustomNames ?? false;
  if (!profile) return { user, profile: null, payments: null, scopeCustomNames };
  const { payMethods, payLabel, ...rest } = profile;
  rest.avatarUrl = rest.avatarUrl ? mediaUrl(normalizeAvatarUrl(rest.avatarUrl)) : null;
  rest.backgroundUrl = mediaUrl(rest.backgroundUrl);
  return {
    user,
    profile: rest,
    payments: { methods: readPayMethods(payMethods), label: payLabelOf(payLabel) },
    scopeCustomNames
  };
};
