/**
 * What a short link does when visited: redirect, ask for a password, show an
 * expired, flagged or one-time page, or preview it (`+`). Shared by `/[slug]`
 * and profile-scoped `/@[handle]/[name]`, so both decide through this one code
 * path. A scoped link is stored under `@handle/name`, so that is its slug here.
 */
import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import bcrypt from 'bcrypt';
import { waitUntil } from '@vercel/functions';
import { classifyPath, decideLink, resolveDestination, surfaceFromQuery } from '@iksi/core';
import { PASSWORD_MAX } from '#lib/password-limits.js';
import { prisma } from '#lib/prisma.js';
import { rateLimit } from '#lib/rateLimit.js';
import { decodeURL } from '#lib/server/crypto.js';
import { clientOf } from '#lib/server/client.js';
import { toLinkRecord } from '#lib/server/link-record.js';
import { claimOneTime, oneTimeState } from '#lib/server/one-time.js';
import { requestContext } from '#lib/server/request-context.js';
import { recordClick } from '#lib/server/tracking.js';

/**
 * A browser must never keep a slug response: a redirect it cached would skip a
 * password, expiry or rule set later. Set exactly once per response, so load
 * sets it for every view and the unlock action only on its own redirect.
 */
const NO_STORE = { 'cache-control': 'private, no-store' };

/**
 * The reveal action sets no-store on the response that carries a secret, and
 * after a no-JS reveal SvelteKit runs load on that same response, so the
 * second set is expected and skipped.
 */
function noStore(event: RequestEvent) {
  try {
    event.setHeaders(NO_STORE);
  } catch {
    // Already set on this response.
  }
}

const UNLOCK_MAX = 10;
const UNLOCK_WINDOW_MS = 10 * 60 * 1000;

const SELECT = {
  id: true,
  originalURL: true,
  safeVerdict: true,
  rules: true,
  expiresAt: true,
  expiredAt: true,
  passwordHash: true,
  permanent: true,
  clickCount: true,
  maxClicks: true,
  oneTime: true,
  secretKind: true,
  openedAt: true
} as const;

type Row = NonNullable<Awaited<ReturnType<typeof findRow>>>;

const OPENED = { message: 'This link was already opened.', view: 'opened' } as const;

/** The link this path names (a slug, or `@handle/name`), or a 404. */
function linkPathOf(event: RequestEvent): { slug: string; mode: 'redirect' | 'preview' } {
  const path = classifyPath(event.url.pathname);
  if ((path.kind !== 'slug' && path.kind !== 'scoped') || path.mode === 'stats') error(404, 'not found');
  return { slug: path.slug, mode: path.mode };
}

function slugOf(event: RequestEvent, mode: 'redirect' | 'preview'): string {
  const path = linkPathOf(event);
  if (path.mode !== mode) error(404, 'not found');
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

async function findRow(slug: string) {
  const row = await prisma.longURL.findUnique({ where: { shortURL: slug }, select: SELECT });
  if (!row) error(404, 'not found');
  return row;
}

async function toRecord(row: Row) {
  const destination = normalize(await decodeURL(row.originalURL));
  if (destination === null) {
    console.error(`link ${row.id}: stored destination is not a valid URL`);
    error(404, 'not found');
  }
  return toLinkRecord(row, destination);
}

/** Unlock and reveal attempts share one budget per slug and visitor. */
async function attemptsExhausted(event: RequestEvent, slug: string) {
  const limit = await rateLimit(`unlock:${slug}:${clientOf(event).ip}`, UNLOCK_MAX, UNLOCK_WINDOW_MS);
  return limit.allowed ? null : fail(429, { error: 'Too many attempts. Try again in a few minutes.' });
}

async function passwordMatches(event: RequestEvent, hash: string): Promise<boolean> {
  const given = (await event.request.formData()).get('password');
  return (
    typeof given === 'string' &&
    given.length > 0 &&
    given.length <= PASSWORD_MAX &&
    (await bcrypt.compare(given, hash))
  );
}

/** Counts a visit past the response. Hover preloads and HEAD never reach here as clicks. */
function countClick(event: RequestEvent, id: number) {
  const { surface, profileId, rowId } = surfaceFromQuery(event.url.searchParams);
  const opts =
    surface === 'profile' ? { surface, profileId: profileId as number, rowId: rowId as number } : { surface };
  waitUntil(recordClick(id, event, opts).catch(() => {}));
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
  // Hover preloads fetch the data endpoint; they must not count as visits.
  if (event.request.method !== 'HEAD' && !event.isDataRequest) countClick(event, record.id);
  redirect(status, target, { external: true });
}

/**
 * What a one-time link shows. Read-only: viewing it (GET, HEAD, a data
 * request, a link-preview bot) never burns it, and the content is not even read.
 */
function oneTimeView(event: RequestEvent, row: Row, mode: 'redirect' | 'preview', now: number) {
  const state = oneTimeState(row, now);

  if (mode === 'preview') {
    return {
      view: 'preview' as const,
      host: '',
      destination: null,
      hasRules: false,
      flagged: state === 'flagged' ? (row.safeVerdict as string) : null,
      expired: state === 'expired',
      oneTime: true,
      opened: state === 'opened'
    };
  }

  switch (state) {
    case 'flagged':
      error(403, { message: 'This link has been disabled.', view: 'flagged', verdict: row.safeVerdict as string });
    case 'opened':
      // After a no-JS reveal SvelteKit renders this POST through load: the page
      // shows the action's result, so this must not become an error page.
      if (event.request.method === 'POST') return { view: 'opened' as const };
      error(410, { ...OPENED });
    case 'expired':
      error(410, { message: 'This link has expired.', view: 'expired' });
    default:
      return {
        view: 'reveal' as const,
        kind: row.secretKind === 'url' ? ('url' as const) : ('text' as const),
        password: row.passwordHash !== null,
        error: null
      };
  }
}

export const load = async (event: RequestEvent) => {
  const path = linkPathOf(event);
  noStore(event);

  const now = Date.now();
  const row = await findRow(path.slug);
  if (row.oneTime) return oneTimeView(event, row, path.mode, now);

  const record = await toRecord(row);
  const decision = decideLink(record, now);

  if (path.mode === 'preview') {
    return {
      view: 'preview' as const,
      host: record.protected ? '' : new URL(record.destination).host,
      destination: decision === 'redirect' || decision === 'protected' ? (record.protected ? null : record.destination) : null,
      hasRules: (record.rules ?? []).length > 0,
      flagged: decision === 'flagged' ? (row.safeVerdict as string) : null,
      expired: decision === 'expired',
      oneTime: false,
      opened: false
    };
  }

  switch (decision) {
    case 'flagged':
      error(403, {
        message: 'This link has been disabled.',
        view: 'flagged',
        verdict: row.safeVerdict as string
      });
    case 'expired':
      error(410, { message: 'This link has expired.', view: 'expired' });
    case 'protected':
      return { view: 'password' as const, error: null };
    default:
      return followLink(event, record, record.permanent ? 301 : 302, now);
  }
};

export const actions = {
  unlock: async (event: RequestEvent) => {
    const slug = slugOf(event, 'redirect');

    const limited = await attemptsExhausted(event, slug);
    if (limited) return limited;

    const now = Date.now();
    const row = await findRow(slug);
    // A one-time link only opens through reveal, which burns it.
    if (row.oneTime) redirect(303, `/${slug}`);
    const record = await toRecord(row);
    // Anything but a still-protected link goes back to the plain route, which decides what to show.
    if (decideLink(record, now) !== 'protected' || !row.passwordHash) redirect(303, `/${slug}`);

    if (!(await passwordMatches(event, row.passwordHash))) return fail(400, { error: 'Wrong password' });

    // A failed attempt renders through load, which sets this itself.
    event.setHeaders(NO_STORE);
    return followLink(event, record, 303, now);
  },

  /**
   * Opens a one-time link: checks the password if it has one, claims the link
   * with one conditional UPDATE that also erases the content, and only then
   * shows the text or redirects to the URL. A reveal that loses the claim gets
   * "already opened" and nothing else.
   */
  reveal: async (event: RequestEvent) => {
    const slug = slugOf(event, 'redirect');

    const limited = await attemptsExhausted(event, slug);
    if (limited) return limited;

    const now = Date.now();
    const row = await prisma.longURL.findUnique({
      where: { shortURL: slug },
      select: { ...SELECT, secret: true }
    });
    if (!row) error(404, 'not found');
    if (!row.oneTime) redirect(303, `/${slug}`);

    const state = oneTimeState(row, now);
    if (state === 'opened' || (state === 'sealed' && row.secret === null)) return fail(410, { opened: true });
    // Flagged or expired: the plain route shows why, and the content is never read.
    if (state !== 'sealed' || row.secret === null) redirect(303, `/${slug}`);

    if (row.passwordHash !== null && !(await passwordMatches(event, row.passwordHash))) {
      return fail(400, { error: 'Wrong password' });
    }

    // Decoded before the claim: content that cannot be read must not be burned.
    const content = await decodeURL(row.secret);
    // decodeURL hands back its input when decryption fails.
    if (content === row.secret) {
      console.error(`link ${row.id}: one-time content could not be decrypted`);
      error(500, 'This link could not be opened.');
    }
    const target = row.secretKind === 'url' ? normalize(content) : null;
    if (row.secretKind === 'url' && target === null) {
      console.error(`link ${row.id}: one-time destination is not a valid URL`);
      error(500, 'This link could not be opened.');
    }

    if (!(await claimOneTime(prisma, row.id, now))) return fail(410, { opened: true });

    noStore(event);
    countClick(event, row.id);
    if (target !== null) redirect(303, target, { external: true });
    return { text: content };
  }
};
