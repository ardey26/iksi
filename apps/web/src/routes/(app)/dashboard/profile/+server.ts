import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyUserSession } from '#lib/server/user-auth.js';
import { checkURLs } from '#lib/server/safe-browsing.js';
import { decodeURL } from '#lib/server/crypto.js';
import { verifyAvatarUrl } from '#lib/server/avatar-url.js';
import { invalidateUserCache } from '#lib/server/user-cache.js';
import { purgeEdge } from '#lib/server/edge-purge.js';
import { destinationsOf, isFlagged } from '#lib/server/link-record.js';
import { r2MediaStore } from '#lib/server/media-store.js';
import { deleteMediaQuietly } from '#lib/server/profile-media.js';

const THEMES = new Set(['dark', 'light', 'default', 'mono']);

// theme can be a numeric brightness string ("0".."100") OR a legacy name.
function validTheme(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  if (THEMES.has(v)) return true;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && n <= 100 && String(n) === v;
}
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

type Db = Awaited<ReturnType<typeof requireProfile>>['prisma'];
type CheckedLink = {
  id: number;
  shortURL: string;
  originalURL: string;
  safeVerdict: string | null;
  rules: unknown;
  settingsVersion: number;
};

/**
 * Re-run Safe Browsing and store the verdict. A changed verdict can flip the
 * edge's `flagged` bit, so the cached record is purged after the write.
 */
async function recheckVerdict(prisma: Db, link: CheckedLink): Promise<string> {
  const raw = await decodeURL(link.originalURL);
  // Rule destinations too: a clean default must not clear a bad rule's flag.
  const verdict = await checkURLs(destinationsOf(raw, link.rules));
  // An incomplete check cannot clear a flag.
  if (verdict === 'pending' && isFlagged(link.safeVerdict)) return link.safeVerdict as string;
  // Written only if the row is still the version that was checked.
  const { count } = await prisma.longURL.updateMany({
    where: { id: link.id, settingsVersion: link.settingsVersion },
    data: { safeVerdict: verdict, safeCheckedAt: new Date() }
  });
  if (count === 0) {
    // Edited meanwhile: that edit's own check settles it; gate on what is stored now.
    const now = await prisma.longURL.findUnique({ where: { id: link.id }, select: { safeVerdict: true } });
    return now?.safeVerdict ?? 'pending';
  }
  if (verdict !== link.safeVerdict) await purgeEdge([link.shortURL]);
  return verdict;
}

async function requireProfile(uid: number) {
  const { prisma } = await import('#lib/prisma.js');
  const p = await prisma.profile.findUnique({ where: { userId: uid } });
  if (!p) throw new Error('No profile');
  return { prisma, p };
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  const uid = verifyUserSession(cookies.get('user_session'));
  if (uid === null) return json({ error: 'Not signed in' }, { status: 401 });

  const body = await request.json();
  const { prisma, p } = await requireProfile(uid);

  switch (body.action) {
    case 'updateProfile': {
      const { displayName, bio, avatarUrl, theme, accent, publicClicks } = body;
      if (bio && bio.length > 200) return json({ error: 'Bio ≤200 chars' }, { status: 400 });
      if (accent && !HEX_RE.test(accent)) return json({ error: 'Accent must be #RRGGBB' }, { status: 400 });

      const submitted = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
      // The stored CDN url means "unchanged": keep avatarKey so the objects survive.
      const keepUploaded = !!p.avatarKey && submitted !== '' && submitted === p.avatarUrl;

      let finalAvatarUrl: string | null = null;
      if (keepUploaded) {
        finalAvatarUrl = p.avatarUrl;
      } else if (submitted.length > 0) {
        const check = await verifyAvatarUrl(avatarUrl);
        if (!check.ok) return json({ error: check.error }, { status: 400 });
        finalAvatarUrl = check.url;
      }

      const data: Record<string, unknown> = { displayName, bio, avatarUrl: finalAvatarUrl, accent };
      const oldKey = keepUploaded ? null : p.avatarKey;
      if (oldKey) data.avatarKey = null;
      if (validTheme(theme)) data.theme = theme;
      if (typeof publicClicks === 'boolean') data.publicClicks = publicClicks;
      await prisma.profile.update({ where: { id: p.id }, data });
      await deleteMediaQuietly(r2MediaStore(), oldKey);
      invalidateUserCache(uid);
      return json({ ok: true, avatarUrl: finalAvatarUrl });
    }
    case 'addRow': {
      const { linkId, title } = body;
      if (!Number.isInteger(linkId) || !title || title.length > 80) return json({ error: 'Invalid' }, { status: 400 });
      const link = await prisma.longURL.findUnique({ where: { id: linkId } });
      if (!link || link.userId !== uid) return json({ error: 'Link not owned' }, { status: 403 });
      const stale = !link.safeCheckedAt || (Date.now() - link.safeCheckedAt.getTime()) > 86400000;
      if (stale) {
        const verdict = await recheckVerdict(prisma, link);
        if (verdict !== 'safe' && verdict !== 'pending') {
          return json({ error: 'This link failed a safety check and cannot be added' }, { status: 422 });
        }
      }
      const last = await prisma.profileRow.aggregate({ where: { profileId: p.id }, _max: { position: true } });
      const position = (last._max.position ?? -1) + 1;
      const created = await prisma.profileRow.create({
        data: { profileId: p.id, linkId, title, position },
        include: { link: { select: { shortURL: true } } }
      });
      return json({ ok: true, row: created });
    }
    case 'upsertRow': {
      // Unified endpoint used by the single-table links UI. Creates the
      // ProfileRow if it doesn't exist, otherwise updates title/enabled.
      const { linkId, title, enabled } = body;
      if (!Number.isInteger(linkId)) return json({ error: 'Invalid linkId' }, { status: 400 });
      if (typeof title !== 'string' || title.length === 0 || title.length > 80) {
        return json({ error: 'Title required (≤80 chars)' }, { status: 400 });
      }
      if (typeof enabled !== 'boolean') return json({ error: 'enabled required' }, { status: 400 });

      const link = await prisma.longURL.findUnique({ where: { id: linkId } });
      if (!link || link.userId !== uid) return json({ error: 'Link not owned' }, { status: 403 });

      // Safe-browsing gate applies only when going public.
      if (enabled) {
        const stale = !link.safeCheckedAt || (Date.now() - link.safeCheckedAt.getTime()) > 86400000;
        if (stale) {
          const verdict = await recheckVerdict(prisma, link);
          if (verdict !== 'safe' && verdict !== 'pending') {
            return json({ error: 'This link failed a safety check' }, { status: 422 });
          }
        }
      }

      const existing = await prisma.profileRow.findFirst({ where: { profileId: p.id, linkId } });
      let row;
      if (existing) {
        row = await prisma.profileRow.update({
          where: { id: existing.id },
          data: { title, enabled },
          include: { link: { select: { shortURL: true } } }
        });
      } else {
        const last = await prisma.profileRow.aggregate({ where: { profileId: p.id }, _max: { position: true } });
        row = await prisma.profileRow.create({
          data: { profileId: p.id, linkId, title, enabled, position: (last._max.position ?? -1) + 1 },
          include: { link: { select: { shortURL: true } } }
        });
      }
      return json({ ok: true, row });
    }
    case 'toggleRow': {
      const { rowId, enabled } = body;
      const row = await prisma.profileRow.findUnique({ where: { id: rowId } });
      if (!row || row.profileId !== p.id) return json({ error: 'Not found' }, { status: 404 });
      await prisma.profileRow.update({ where: { id: rowId }, data: { enabled: !!enabled } });
      return json({ ok: true });
    }
    case 'moveRow': {
      const { rowId, direction } = body;
      const row = await prisma.profileRow.findUnique({ where: { id: rowId } });
      if (!row || row.profileId !== p.id) return json({ error: 'Not found' }, { status: 404 });
      const neighbor = await prisma.profileRow.findFirst({
        where: {
          profileId: p.id,
          position: direction === 'up' ? { lt: row.position } : { gt: row.position }
        },
        orderBy: { position: direction === 'up' ? 'desc' : 'asc' }
      });
      if (!neighbor) return json({ ok: true });
      await prisma.$transaction([
        prisma.profileRow.update({ where: { id: row.id }, data: { position: neighbor.position } }),
        prisma.profileRow.update({ where: { id: neighbor.id }, data: { position: row.position } })
      ]);
      return json({ ok: true });
    }
    case 'reorderRows': {
      const { orderedIds } = body;
      if (!Array.isArray(orderedIds) || !orderedIds.every((x) => Number.isInteger(x))) {
        return json({ error: 'Invalid order' }, { status: 400 });
      }
      // Verify all rows belong to this profile
      const rows = await prisma.profileRow.findMany({
        where: { id: { in: orderedIds }, profileId: p.id },
        select: { id: true }
      });
      if (rows.length !== orderedIds.length) return json({ error: 'Rows not owned' }, { status: 403 });
      // Two-phase update to sidestep the (profileId, position) uniqueness during renumber.
      // Phase 1: bump every touched row to a temporary high offset.
      // Phase 2: assign final 0..N-1 positions.
      const offset = 1000000;
      await prisma.$transaction([
        ...orderedIds.map((id, i) =>
          prisma.profileRow.update({ where: { id }, data: { position: offset + i } })
        ),
        ...orderedIds.map((id, i) =>
          prisma.profileRow.update({ where: { id }, data: { position: i } })
        )
      ]);
      return json({ ok: true });
    }
    case 'deleteRow': {
      const { rowId } = body;
      const row = await prisma.profileRow.findUnique({ where: { id: rowId } });
      if (!row || row.profileId !== p.id) return json({ error: 'Not found' }, { status: 404 });
      await prisma.profileRow.delete({ where: { id: rowId } });
      return json({ ok: true });
    }
    default:
      return json({ error: 'Unknown action' }, { status: 400 });
  }
};
