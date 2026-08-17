import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyUserSession } from '$lib/server/user-auth';
import { checkURL } from '$lib/server/safe-browsing';
import { decodeURL } from '$lib/server/crypto.js';
import { verifyAvatarUrl } from '$lib/server/avatar-url';

const THEMES = new Set(['dark', 'light', 'default', 'mono']);

// theme can be a numeric brightness string ("0".."100") OR a legacy name.
function validTheme(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  if (THEMES.has(v)) return true;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && n <= 100 && String(n) === v;
}
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

async function requireProfile(uid: number) {
  const { prisma } = await import('$lib/prisma.js');
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

      let finalAvatarUrl: string | null = null;
      if (typeof avatarUrl === 'string' && avatarUrl.trim().length > 0) {
        const check = await verifyAvatarUrl(avatarUrl);
        if (!check.ok) return json({ error: check.error }, { status: 400 });
        finalAvatarUrl = check.url;
      }

      const data: Record<string, unknown> = { displayName, bio, avatarUrl: finalAvatarUrl, accent };
      if (validTheme(theme)) data.theme = theme;
      if (typeof publicClicks === 'boolean') data.publicClicks = publicClicks;
      await prisma.profile.update({ where: { id: p.id }, data });
      return json({ ok: true, avatarUrl: finalAvatarUrl });
    }
    case 'addRow': {
      const { linkId, title } = body;
      if (!Number.isInteger(linkId) || !title || title.length > 80) return json({ error: 'Invalid' }, { status: 400 });
      const link = await prisma.longURL.findUnique({ where: { id: linkId } });
      if (!link || link.userId !== uid) return json({ error: 'Link not owned' }, { status: 403 });
      const stale = !link.safeCheckedAt || (Date.now() - link.safeCheckedAt.getTime()) > 86400000;
      if (stale) {
        const raw = await decodeURL(link.originalURL);
        const verdict = await checkURL(raw);
        await prisma.longURL.update({
          where: { id: link.id },
          data: { safeVerdict: verdict, safeCheckedAt: new Date() }
        });
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
