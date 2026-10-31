import type { RequestHandler } from './$types';
import { isInternalCall } from '#lib/server/edge-auth.js';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * Lets the Worker's `/_health?deep=1` prove it shares EDGE_SECRET with this
 * origin. A mismatch would otherwise go unnoticed: redirects fall back to the
 * origin route and keep working, only slower.
 */
export const GET: RequestHandler = ({ request }) => {
  if (!isInternalCall(request.headers)) {
    return new Response('unauthorized', { status: 401, headers: NO_STORE });
  }
  return new Response(null, { status: 204, headers: NO_STORE });
};
