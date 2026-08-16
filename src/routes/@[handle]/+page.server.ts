import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { decodeURL } from '$lib/server/crypto.js';

export const load: PageServerLoad = async ({ params, request, platform }) => {
  const raw = params.handle;
  const handle = (raw.startsWith('@') ? raw.slice(1) : raw).toLowerCase();

  const { prisma } = await import('$lib/prisma.js');
  const record = await prisma.handle.findUnique({
    where: { handle },
    include: {
      user: {
        include: {
          profile: {
            include: {
              rows: {
                where: { enabled: true, quarantined: false },
                orderBy: { position: 'asc' },
                include: { link: true }
              }
            }
          }
        }
      }
    }
  });

  if (!record?.user?.profile) throw error(404, 'not found');
  const p = record.user.profile;

  const rows = await Promise.all(p.rows.map(async (r) => ({
    id: r.id,
    title: r.title,
    href: r.link ? `/${r.link.shortURL}?s=profile&p=${p.id}&r=${r.id}` : null,
    destination: r.link ? await decodeURL(r.link.originalURL) : null,
    clicks: p.publicClicks && r.link ? r.link.clickCount : null
  })));

  // Fire-and-forget profile view (do not block)
  const { recordProfileView } = await import('$lib/server/tracking');
  const event = { request } as any;
  const view = recordProfileView(p.id, event);
  if (platform?.context?.waitUntil) platform.context.waitUntil(view); else view.catch(() => {});

  return {
    handle,
    displayName: p.displayName ?? `@${handle}`,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    theme: p.theme,
    accent: p.accent,
    publicClicks: p.publicClicks,
    rows
  };
};
