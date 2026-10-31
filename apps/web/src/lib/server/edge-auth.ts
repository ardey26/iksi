import { secretMatches } from '#lib/server/client.js';

/**
 * The edge Worker puts EDGE_SECRET in this header on its own calls to
 * /internal/*. Distinct from EDGE_HEADERS.secret (x-iksi-edge), which the
 * Worker attaches to every forwarded visitor request and so proves nothing
 * about who sent it. Must match INTERNAL_HEADER in apps/redirect/src/auth.ts.
 */
export const INTERNAL_HEADER = 'x-iksi-internal';

/** True only for the edge Worker's own internal calls. */
export function isInternalCall(headers: Headers): boolean {
  return secretMatches(headers.get(INTERNAL_HEADER), process.env.EDGE_SECRET);
}
