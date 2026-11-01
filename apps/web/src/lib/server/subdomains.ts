/**
 * Server side of `<handle>.iksi.app` (see lib/subdomains.ts for the mapping).
 * Everything here is inert until SUBDOMAINS_ENABLED=true: www never redirects,
 * and a subdomain request is sent back to the same page on www, uncached, so a
 * switch-off also catches browsers that still hold the www -> subdomain 301.
 */
import { WWW_HOST, WWW_ORIGIN, APEX, handlePath, hasSubdomain, subdomainHandleOf } from '#lib/subdomains.js';

export const subdomainsEnabled = (): boolean => process.env.SUBDOMAINS_ENABLED === 'true';

/**
 * Browsers recheck the www -> subdomain redirect daily, so switching the flag
 * off undoes a cached redirect within a day.
 */
export const REDIRECT_CACHE_CONTROL = 'public, max-age=86400';

const PROFILE_ROUTES = new Set(['/@[handle]', '/@[handle]/[name]']);

/**
 * Marks the switched-off subdomain's 302 back to www. A browser keys its cached
 * www -> subdomain 301 by the full URL, so the marked URL never matches it and
 * cannot loop; www never sends a marked request to a subdomain either. The
 * page ignores it: canonicals carry no query, and on the CDN it is at most one
 * extra copy per profile, tagged by owner like the plain one.
 */
export const VIA_PARAM = 'via';
const VIA_SUB = 'sub';

function withVia(search: string): string {
  const q = new URLSearchParams(search);
  q.set(VIA_PARAM, VIA_SUB);
  return `?${q}`;
}

export type SubdomainDecision =
  | { kind: 'pass' }
  | { kind: 'redirect'; status: 301; location: string; cacheControl: string }
  | { kind: 'redirect'; status: 302; location: string; cacheControl?: string };

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

  if (!req.enabled || req.host.toLowerCase().replace(/:\d+$/, '') !== WWW_HOST) return PASS;
  if (req.method !== 'GET' && req.method !== 'HEAD') return PASS;
  if (!req.routeId || !PROFILE_ROUTES.has(req.routeId) || !req.handle) return PASS;
  if (new URLSearchParams(req.search).get(VIA_PARAM) === VIA_SUB) return PASS;

  const handle = req.handle.toLowerCase();
  if (!hasSubdomain(handle)) return PASS;
  const rest = req.pathname.replace(/^\/@[^/]+/, '') || '/';
  return {
    kind: 'redirect',
    status: 301,
    location: `https://${handle}.${APEX}${rest}${req.search}`,
    cacheControl: REDIRECT_CACHE_CONTROL
  };
}
