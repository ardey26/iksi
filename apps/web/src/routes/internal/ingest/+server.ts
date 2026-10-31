import type { RequestHandler } from './$types';
import { isFromEdge } from '#lib/server/edge-auth.js';
import { ingestClicks, prismaIngestDb } from '#lib/server/ingest.js';

const NO_STORE = { 'cache-control': 'no-store' };
const MAX_EVENTS = 500;

export const POST: RequestHandler = async ({ request }) => {
  if (!isFromEdge(request.headers)) {
    return new Response('unauthorized', { status: 401, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('bad request', { status: 400, headers: NO_STORE });
  }
  const events = (body as { events?: unknown } | null)?.events;
  if (!Array.isArray(events) || events.length > MAX_EVENTS) {
    return new Response('bad request', { status: 400, headers: NO_STORE });
  }

  const { prisma } = await import('#lib/prisma.js');
  let result;
  try {
    result = await ingestClicks(events, prismaIngestDb(prisma));
  } catch (err) {
    console.error('ingest failed', err);
    return new Response('ingest failed', { status: 500, headers: NO_STORE });
  }
  return new Response(JSON.stringify(result), {
    headers: { ...NO_STORE, 'content-type': 'application/json' }
  });
};
