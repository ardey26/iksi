import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { decodeURL } from '$lib/server/crypto.js';
import { normalizeAvatarUrl } from '$lib/server/avatar-url';

// Popular social domains we recognize on row destinations — used to build
// Schema.org `sameAs` entries so Google can associate the profile with the
// user's other public identities.
const SOCIAL_DOMAIN_RE = /^(?:www\.)?(twitter\.com|x\.com|youtube\.com|instagram\.com|github\.com|linkedin\.com|tiktok\.com|threads\.net|bsky\.app|dribbble\.com|behance\.net|substack\.com|medium\.com|dev\.to)$/i;

function extractSameAs(destinations: (string | null)[]): string[] {
  const out: string[] = [];
  for (const d of destinations) {
    if (!d) continue;
    try {
      const u = new URL(d);
      if (SOCIAL_DOMAIN_RE.test(u.hostname)) out.push(u.toString());
    } catch {}
  }
  return Array.from(new Set(out));
}

export const load: PageServerLoad = async ({ params, request, platform }) => {
  const raw = params.handle;
  const handle = (raw.startsWith('@') ? raw.slice(1) : raw).toLowerCase();

  const { prisma } = await import('$lib/prisma.js');
  const record = await prisma.handle.findUnique({
    where: { handle },
    select: {
      user: {
        select: {
          profile: {
            select: {
              id: true,
              displayName: true,
              bio: true,
              avatarUrl: true,
              theme: true,
              accent: true,
              publicClicks: true,
              rows: {
                where: { enabled: true, quarantined: false },
                orderBy: { position: 'asc' },
                select: {
                  id: true,
                  title: true,
                  link: {
                    select: {
                      id: true,
                      shortURL: true,
                      originalURL: true,
                      clickCount: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!record?.user?.profile) throw error(404, 'not found');
  const p = record.user.profile;

  // Decode originalURL once per row so we can (a) compute the social sameAs
  // list for JSON-LD and (b) not send the encrypted ciphertext to the client.
  // The decoded destination is deliberately NOT returned to the client — the
  // profile page renders titles + short URLs only. Keeping the destination
  // server-side avoids leaking anything the redirect endpoint doesn't already.
  const decoded = await Promise.all(
    p.rows.map((r) => (r.link ? decodeURL(r.link.originalURL) : Promise.resolve(null)))
  );

  const rows = p.rows.map((r, i) => ({
    id: r.id,
    title: r.title,
    shortURL: r.link?.shortURL ?? null,
    href: r.link ? `/${r.link.shortURL}?s=profile&p=${p.id}&r=${r.id}` : null,
    clicks: p.publicClicks && r.link ? r.link.clickCount : null
  }));

  const sameAs = extractSameAs(decoded);

  // Fire-and-forget profile view (do not block)
  const { recordProfileView } = await import('$lib/server/tracking');
  const event = { request } as any;
  const view = recordProfileView(p.id, event);
  if (platform?.context?.waitUntil) platform.context.waitUntil(view); else view.catch(() => {});

  return {
    handle,
    displayName: p.displayName ?? `@${handle}`,
    bio: p.bio,
    avatarUrl: p.avatarUrl ? normalizeAvatarUrl(p.avatarUrl) : null,
    theme: p.theme,
    accent: p.accent,
    publicClicks: p.publicClicks,
    rows,
    sameAs
  };
};
