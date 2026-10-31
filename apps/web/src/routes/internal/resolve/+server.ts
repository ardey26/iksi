import type { RequestHandler } from './$types';
import { isFromEdge } from '#lib/server/edge-auth.js';
import { decodeURL } from '#lib/server/crypto.js';
import { toLinkRecord } from '#lib/server/link-record.js';

const NO_STORE = { 'cache-control': 'no-store' };
const MAX_SLUG = 64;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...NO_STORE, 'content-type': 'application/json' }
  });
}

export const GET: RequestHandler = async ({ url, request }) => {
  if (!isFromEdge(request.headers)) {
    return new Response('unauthorized', { status: 401, headers: NO_STORE });
  }

  const slug = url.searchParams.get('slug');
  if (!slug || slug.length > MAX_SLUG) {
    return new Response('bad request', { status: 400, headers: NO_STORE });
  }

  const { prisma } = await import('#lib/prisma.js');
  const row = await prisma.longURL.findUnique({
    where: { shortURL: slug },
    select: { id: true, originalURL: true, safeVerdict: true }
  });
  if (!row) return json({ found: false }, 404);

  const destination = await decodeURL(row.originalURL);
  return json({ found: true, record: toLinkRecord(row, destination) });
};
