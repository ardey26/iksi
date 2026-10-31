import { EDGE_HEADERS, secretMatches } from '#lib/server/client.js';

/** True when the request carries the edge Worker's shared secret. */
export function isFromEdge(headers: Headers): boolean {
  return secretMatches(headers.get(EDGE_HEADERS.secret), process.env.EDGE_SECRET);
}
