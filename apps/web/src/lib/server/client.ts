import { timingSafeEqual } from 'node:crypto';

/**
 * Behind Cloudflare, Vercel sees Cloudflare's IP and location, not the
 * visitor's. The edge Worker forwards the real values in these headers along
 * with a shared secret, so requests that reach Vercel directly (for example
 * via *.vercel.app) cannot spoof them.
 */
export const EDGE_HEADERS = {
  secret: 'x-iksi-edge',
  ip: 'x-iksi-client-ip',
  country: 'x-iksi-client-country'
} as const;

export interface ClientInfo {
  ip: string;
  country: string | null;
}

function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function resolveClient(
  headers: Headers,
  edgeSecret: string | undefined,
  platformIp: () => string
): ClientInfo {
  const fallbackIp = () => {
    try {
      return platformIp();
    } catch {
      return 'unknown';
    }
  };

  if (secretMatches(headers.get(EDGE_HEADERS.secret), edgeSecret)) {
    return {
      ip: headers.get(EDGE_HEADERS.ip) || fallbackIp(),
      country: headers.get(EDGE_HEADERS.country) || null
    };
  }
  return { ip: fallbackIp(), country: headers.get('x-vercel-ip-country') || null };
}

/** The visitor's IP and country for a SvelteKit request event. */
export function clientOf(event: { request: Request; getClientAddress?: () => string }): ClientInfo {
  return resolveClient(event.request.headers, process.env.EDGE_SECRET, () => {
    if (!event.getClientAddress) throw new Error('no platform address');
    return event.getClientAddress();
  });
}
