import type { RequestHandler } from './$types';
import { prisma } from '#lib/prisma.js';
import { rateLimit } from '#lib/rateLimit.js';
import { API_KEY_RATE, authenticateApiKey, readBearer } from '#lib/server/api-keys.js';
import { extensionPreflight, withExtensionCors } from '#lib/server/extension-cors.js';
import { normalizeAvatarUrl } from '#lib/server/avatar-url.js';
import { mediaUrl } from '#lib/server/media-url.js';
import { PUBLIC_ROW_WHERE, publicRows } from '#lib/server/profile-rows.js';
import { subdomainsEnabled } from '#lib/server/subdomains.js';
import { profilePalette } from '#lib/profile-palette.js';
import { WWW_ORIGIN, profileShareUrl } from '#lib/subdomains.js';

// The browser extension's popup: the key owner's profile, its palette and the
// links their public profile lists, so they can copy any of them.

/** The palette tokens the popup applies. */
const POPUP_TOKENS = ['--bg', '--surface', '--surface-2', '--border', '--text-primary', '--text-muted', '--accent'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

const invalidKey = () => json({ error: 'Invalid API key', code: 'invalid_key' }, 401);

async function profileOf(request: Request): Promise<Response> {
  // Keyed only: the popup has no session, and a missing key is a bad key.
  const bearer = readBearer(request.headers.get('authorization'));
  if (bearer.kind !== 'key') return invalidKey();
  const key = await authenticateApiKey(bearer.key);
  if (!key) return invalidKey();

  // Its own bucket, so opening the popup never uses up the key's shortens.
  const limit = await rateLimit(`apikey:${key.id}:profile`, API_KEY_RATE.requests, API_KEY_RATE.windowMs);
  if (!limit.allowed) return json({ error: 'Too many requests for this key. Please wait a minute.' }, 429);

  const user = await prisma.user.findUnique({
    where: { id: key.userId },
    select: {
      handle: { select: { handle: true } },
      profile: {
        select: {
          displayName: true,
          avatarUrl: true,
          theme: true,
          accent: true,
          rows: {
            where: PUBLIC_ROW_WHERE,
            orderBy: { position: 'asc' },
            select: { title: true, link: { select: { shortURL: true, oneTime: true } } }
          }
        }
      }
    }
  });
  if (!user) return invalidKey();

  const handle = user.handle?.handle ?? null;
  const p = user.profile;
  const palette = profilePalette(p?.accent, p?.theme);

  return json({
    handle,
    displayName: p?.displayName?.trim() || null,
    avatarUrl: p?.avatarUrl ? mediaUrl(normalizeAvatarUrl(p.avatarUrl)) : null,
    profileUrl: handle ? profileShareUrl(handle, subdomainsEnabled()) : null,
    palette: {
      scheme: palette.scheme,
      tokens: Object.fromEntries(POPUP_TOKENS.map((k) => [k, palette.tokens[k]]))
    },
    // Rows whose link was deleted have nothing to copy.
    links: handle
      ? publicRows(p?.rows ?? []).flatMap((r) =>
          r.link
            ? [{ title: r.title, url: `${WWW_ORIGIN}/${r.link.shortURL}`, path: `/${r.link.shortURL.split('/').pop()}` }]
            : []
        )
      : []
  });
}

export const OPTIONS: RequestHandler = async ({ request }) => extensionPreflight(request, 'GET');

export const GET: RequestHandler = async ({ request }) => withExtensionCors(request, await profileOf(request));
