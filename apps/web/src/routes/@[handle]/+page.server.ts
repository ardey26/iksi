import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { decodeURL } from '#lib/server/crypto.js';
import { normalizeAvatarUrl } from '#lib/server/avatar-url.js';

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

// Edge cache: profiles are public and viewer-independent (the root layout
// returns user: null for this route). 60s fresh, 10min stale-while-revalidate.
const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=600';

export const load: PageServerLoad = async ({ params, request, setHeaders }) => {
  const raw = params.handle;
  const handle = (raw.startsWith('@') ? raw.slice(1) : raw).toLowerCase();

  const { prisma } = await import('#lib/prisma.js');
  // Start from Profile and filter through the relation. Prisma 4 issues one
  // query per nested relation, so this is 3 round trips (profile, rows, link)
  // instead of 5 (handle, user, profile, rows, link).
  const p = await prisma.profile.findFirst({
    where: { user: { handle: { handle } } },
    select: {
      id: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      backgroundUrl: true,
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
              clickCount: true,
              // Read only to keep a protected destination out of sameAs; never returned.
              passwordHash: true
            }
          }
        }
      }
    }
  });

  if (!p) error(404, 'not found');

  // Decode originalURL once per row so we can (a) compute the social sameAs
  // list for JSON-LD and (b) not send the encrypted ciphertext to the client.
  // The decoded destination is deliberately NOT returned to the client — the
  // profile page renders titles + short URLs only. Keeping the destination
  // server-side avoids leaking anything the redirect endpoint doesn't already.
  // A password-protected link's destination is secret, so it is never decoded here.
  const decoded = await Promise.all(
    p.rows.map((r) =>
      r.link && r.link.passwordHash === null ? decodeURL(r.link.originalURL) : Promise.resolve(null)
    )
  );

  const rows = p.rows.map((r, i) => ({
    id: r.id,
    title: r.title,
    shortURL: r.link?.shortURL ?? null,
    href: r.link ? `/${r.link.shortURL}?s=profile&p=${p.id}&r=${r.id}` : null,
    clicks: p.publicClicks && r.link ? r.link.clickCount : null
  }));

  const sameAs = extractSameAs(decoded);

  // Record the view before responding. Vercel's Node runtime freezes the
  // function once the response is sent, so a fire-and-forget write here was
  // silently dropped. With the function co-located with the DB this is one
  // short round trip, and with edge caching it only runs on cache misses.
  const { recordProfileView } = await import('#lib/server/tracking.js');
  await recordProfileView(p.id, { request } as any);

  setHeaders({ 'cache-control': CACHE_CONTROL });

  return {
    handle,
    displayName: p.displayName ?? `@${handle}`,
    bio: p.bio,
    avatarUrl: p.avatarUrl ? normalizeAvatarUrl(p.avatarUrl) : null,
    backgroundUrl: p.backgroundUrl ?? null,
    theme: p.theme,
    accent: p.accent,
    publicClicks: p.publicClicks,
    rows,
    sameAs
  };
};
