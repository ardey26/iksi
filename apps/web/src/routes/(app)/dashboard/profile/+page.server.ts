import type { PageServerLoad } from './$types';
import { normalizeAvatarUrl } from '#lib/server/avatar-url.js';
import { mediaUrl } from '#lib/server/media-url.js';
import { readPayMethods } from '#lib/server/pay-methods.js';
import { payLabelOf } from '#lib/pay-methods.js';
import { PUBLIC_ROW_WHERE, publicRows } from '#lib/server/profile-rows.js';

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
        payLabel: true,
        // The preview lists what the public page lists, in its order.
        rows: {
          where: PUBLIC_ROW_WHERE,
          orderBy: { position: 'asc' },
          select: { id: true, title: true, link: { select: { oneTime: true } } }
        }
      }
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { scopeCustomNames: true } })
  ]);
  const scopeCustomNames = account?.scopeCustomNames ?? false;
  if (!profile) return { user, profile: null, payments: null, scopeCustomNames, rows: [] };
  const { payMethods, payLabel, rows, ...rest } = profile;
  rest.avatarUrl = rest.avatarUrl ? mediaUrl(normalizeAvatarUrl(rest.avatarUrl)) : null;
  rest.backgroundUrl = mediaUrl(rest.backgroundUrl);
  return {
    user,
    profile: rest,
    payments: { methods: readPayMethods(payMethods), label: payLabelOf(payLabel) },
    scopeCustomNames,
    rows: publicRows(rows).map((r) => ({ id: r.id, title: r.title }))
  };
};
