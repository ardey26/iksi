import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyUserSession } from '#lib/server/user-auth.js';
import { decodeURL } from '#lib/server/crypto.js';
import { settleVerdictInBackground } from '#lib/server/link-verdict.js';
import { validateSettings, toLinkSettings, type SettingsInput } from '#lib/server/link-settings.js';
import { purgeEdge } from '#lib/server/edge-purge.js';
import { destinationsOf } from '#lib/server/link-record.js';

export const PATCH: RequestHandler = async ({ request, cookies }) => {
  const uid = verifyUserSession(cookies.get('user_session'));
  if (uid === null) return json({ error: 'Not signed in' }, { status: 401 });
  const body = await request.json();
  const { id, originalURL, ...rest } = body ?? {};
  if (!Number.isInteger(id)) return json({ error: 'Invalid input' }, { status: 400 });
  const input: SettingsInput = { ...rest };
  // { id, originalURL } is the older body shape for a destination change.
  if (input.destination === undefined && originalURL !== undefined) input.destination = originalURL;
  if (Object.keys(input).length === 0) return json({ error: 'Invalid input' }, { status: 400 });

  const { prisma } = await import('#lib/prisma.js');
  const link = await prisma.longURL.findUnique({ where: { id } });
  if (!link || link.userId !== uid) return json({ error: 'Not found' }, { status: 404 });

  let currentDestination: string | undefined;
  try {
    currentDestination = await decodeURL(link.originalURL);
  } catch {
    currentDestination = undefined;
  }
  const result = await validateSettings(
    input,
    {
      clickCount: link.clickCount ?? 0,
      destination: currentDestination,
      expiresAt: link.expiresAt,
      maxClicks: link.maxClicks
    },
    Date.now()
  );
  if (!result.ok) return json({ error: result.error }, { status: 400 });
  if (Object.keys(result.data).length === 0) return json({ error: 'Nothing to change' }, { status: 400 });

  const saved = await prisma.longURL.update({ where: { id }, data: result.data });
  const row = { ...link, ...saved };
  await purgeEdge([link.shortURL]);

  const destination = result.destinationChanged ?? currentDestination ?? '';
  // Stored destinations are encrypted, so the check uses the plaintext held here.
  // The verdict re-check purges again once it settles.
  if (result.destinationChanged || result.rulesChanged) {
    settleVerdictInBackground(link.shortURL, destinationsOf(destination, row.rules).filter(Boolean));
  }

  return json({ ok: true, settings: toLinkSettings(row, destination) });
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
  const uid = verifyUserSession(cookies.get('user_session'));
  if (uid === null) return json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await request.json();
  if (!Number.isInteger(id)) return json({ error: 'Invalid input' }, { status: 400 });

  const { prisma } = await import('#lib/prisma.js');
  const link = await prisma.longURL.findUnique({ where: { id } });
  if (!link || link.userId !== uid) return json({ error: 'Not found' }, { status: 404 });

  // Cascade: kill any ProfileRow that referenced this link too. Schema uses
  // SetNull, but the unified links UI treats a link and its public row as one
  // entity — leaving orphaned rows labeled "deleted" would surprise the user.
  await prisma.$transaction([
    prisma.profileRow.deleteMany({ where: { linkId: id } }),
    prisma.longURL.delete({ where: { id } })
  ]);
  await purgeEdge([link.shortURL]);
  return json({ ok: true });
};
