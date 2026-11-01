/**
 * Server side of `<handle>.iksi.app` (see lib/subdomains.ts for the mapping).
 * www/@handle is the canonical profile URL and www always serves it; the
 * subdomain is a vanity alias for sharing. Everything here is inert until
 * SUBDOMAINS_ENABLED=true: a subdomain request is sent back to the same page
 * on www, uncached.
 */
import { WWW_ORIGIN, handlePath, subdomainHandleOf } from '#lib/subdomains.js';

export const subdomainsEnabled = (): boolean => process.env.SUBDOMAINS_ENABLED === 'true';

const PROFILE_ROUTES = new Set(['/@[handle]', '/@[handle]/[name]']);

/**
 * Marks the switched-off subdomain's 302 back to www. An earlier version 301'd
 * www/@handle to the subdomain; a browser keys a cached 301 by the full URL, so
 * the marked URL never matches one and cannot loop. The page ignores it:
 * canonicals carry no query, and on the CDN it is at most one extra copy per
 * profile, tagged by owner like the plain one.
 */
export const VIA_PARAM = 'via';
const VIA_SUB = 'sub';

function withVia(search: string): string {
  const q = new URLSearchParams(search);
  q.set(VIA_PARAM, VIA_SUB);
  return `?${q}`;
}

export type SubdomainDecision = { kind: 'pass' } | { kind: 'redirect'; status: 302; location: string; cacheControl?: string };

const PASS: SubdomainDecision = { kind: 'pass' };

/** What a subdomain serves itself: the owner's profile and links, plus what that page loads. */
function servedOnSubdomain(sub: string, pathname: string, routeId: string | null, handle: string | undefined): boolean {
  if (routeId && PROFILE_ROUTES.has(routeId)) return handle?.toLowerCase() === sub;
  const api = `/api/@${sub}`;
  return pathname === api || pathname.startsWith(`${api}/`) || pathname.startsWith('/media/') || pathname === '/robots.txt';
}

export function subdomainDecision(req: {
  host: string;
  pathname: string;
  search: string;
  method: string;
  routeId: string | null;
  /** The route's `handle` param, when it has one. */
  handle: string | undefined;
  enabled: boolean;
  dev?: boolean;
}): SubdomainDecision {
  const sub = subdomainHandleOf(req.host, req.dev);
  if (sub) {
    if (!req.enabled) {
      const path = handlePath(sub, req.pathname) ?? req.pathname;
      return { kind: 'redirect', status: 302, location: `${WWW_ORIGIN}${path}${withVia(req.search)}`, cacheControl: 'no-store' };
    }
    if (servedOnSubdomain(sub, req.pathname, req.routeId, req.handle)) return PASS;
    // Unmatched paths 404 as usual; app pages live on www, where the session cookie is.
    if (req.routeId === null) return PASS;
    return { kind: 'redirect', status: 302, location: `${WWW_ORIGIN}${req.pathname}${req.search}` };
  }

  // www (and every other host) serves itself: www/@handle is canonical.
  return PASS;
}
