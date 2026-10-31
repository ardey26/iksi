import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import bcrypt from 'bcrypt';
import { waitUntil } from '@vercel/functions';
import { classifyPath, decideLink, resolveDestination, surfaceFromQuery } from '@iksi/core';
import { prisma } from '#lib/prisma.js';
import { rateLimit } from '#lib/rateLimit.js';
import { decodeURL } from '#lib/server/crypto.js';
import { clientOf } from '#lib/server/client.js';
import { toLinkRecord } from '#lib/server/link-record.js';
import { requestContext } from '#lib/server/request-context.js';
import { recordClick } from '#lib/server/tracking.js';

const UNLOCK_MAX = 10;
const UNLOCK_WINDOW_MS = 10 * 60 * 1000;
const MAX_PASSWORD_LENGTH = 200;

const SELECT = {
  id: true,
  originalURL: true,
  safeVerdict: true,
  rules: true,
  expiresAt: true,
  expiredAt: true,
  passwordHash: true,
  permanent: true
} as const;

/** Where the hook should send a non-200 status for a rendered view (load cannot set one). */
function setViewStatus(event: RequestEvent, status: number) {
  (event.locals as Record<string, unknown>).viewStatus = status;
}

function slugOf(event: RequestEvent, mode: 'redirect' | 'preview'): string {
  const path = classifyPath(event.url.pathname);
  if (path.kind !== 'slug' || path.mode !== mode) error(404, 'not found');
  return path.slug;
}

/** Percent-encodes anything the Location header cannot carry. Null when it is not a URL. */
function normalize(url: string): string | null {
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

async function loadLink(slug: string) {
  const row = await prisma.longURL.findUnique({ where: { shortURL: slug }, select: SELECT });
  if (!row) error(404, 'not found');
  const destination = normalize(await decodeURL(row.originalURL));
  if (destination === null) {
    console.error(`link ${row.id}: stored destination is not a valid URL`);
    error(404, 'not found');
  }
  return { row, record: toLinkRecord(row, destination) };
}

/** Records the click past the response and redirects to the rule-resolved destination. */
function followLink(
  event: RequestEvent,
  record: ReturnType<typeof toLinkRecord>,
  status: 301 | 302 | 303,
  now: number
): never {
  const { destination } = resolveDestination(
    record.destination,
    record.rules ?? [],
    requestContext(event, now),
    Math.random
  );
  const target = normalize(destination) ?? record.destination;
  if (event.request.method !== 'HEAD') {
    const { surface, profileId, rowId } = surfaceFromQuery(event.url.searchParams);
    const opts =
      surface === 'profile'
        ? { surface, profileId: profileId as number, rowId: rowId as number }
        : { surface };
    waitUntil(recordClick(record.id, event, opts).catch(() => {}));
  }
  redirect(status, target, { external: true });
}

export const load = async (event: RequestEvent) => {
  const path = classifyPath(event.url.pathname);
  if (path.kind !== 'slug' || path.mode === 'stats') error(404, 'not found');

  const now = Date.now();
  const { row, record } = await loadLink(path.slug);

  if (path.mode === 'preview') {
    return {
      view: 'preview' as const,
      host: record.protected ? '' : new URL(record.destination).host,
      destination: record.protected ? null : record.destination,
      hasRules: (record.rules ?? []).length > 0
    };
  }

  switch (decideLink(record, now)) {
    case 'flagged':
      setViewStatus(event, 403);
      return { view: 'flagged' as const, verdict: row.safeVerdict as string };
    case 'expired':
      setViewStatus(event, 410);
      return { view: 'expired' as const };
    case 'protected':
      return { view: 'password' as const, error: null };
    default:
      return followLink(event, record, record.permanent ? 301 : 302, now);
  }
};

export const actions = {
  unlock: async (event: RequestEvent) => {
    const slug = slugOf(event, 'redirect');

    const limit = await rateLimit(
      `unlock:${slug}:${clientOf(event).ip}`,
      UNLOCK_MAX,
      UNLOCK_WINDOW_MS
    );
    if (!limit.allowed) {
      return fail(429, { error: 'Too many attempts. Try again in a few minutes.' });
    }

    const now = Date.now();
    const { row, record } = await loadLink(slug);
    // Anything but a still-protected link goes back to the plain route, which decides what to show.
    if (decideLink(record, now) !== 'protected' || !row.passwordHash) redirect(303, `/${slug}`);

    const given = (await event.request.formData()).get('password');
    const ok =
      typeof given === 'string' &&
      given.length > 0 &&
      given.length <= MAX_PASSWORD_LENGTH &&
      (await bcrypt.compare(given, row.passwordHash));
    if (!ok) return fail(400, { error: 'Wrong password' });

    return followLink(event, record, 303, now);
  }
};
