import { EDGE_HEADERS } from '#lib/server/client.js';

const DEFAULT_URL = 'https://www.iksi.app/_edge/purge';
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 200;

/**
 * Tell the edge Worker to drop its cached destination for these slugs.
 * True only on 204. Never throws: a failed purge must not break the request
 * that triggered it.
 */
export async function purgeEdge(slugs: string[], fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const secret = process.env.EDGE_SECRET;
  if (!secret || slugs.length === 0) return false;

  const url = process.env.EDGE_PURGE_URL ?? DEFAULT_URL;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [EDGE_HEADERS.secret]: secret },
        body: JSON.stringify({ slugs })
      });
      if (res.status === 204) return true;
      if (res.status < 500) break;
    } catch {
      // network error: retry
    }
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  console.warn('edge purge failed', slugs);
  return false;
}
