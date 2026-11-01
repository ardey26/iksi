/**
 * `<handle>.iksi.app` profile subdomains. Universal (no server imports): the
 * reroute hook runs on the client too. Whether subdomains are switched on is a
 * server secret (SUBDOMAINS_ENABLED, see lib/server/subdomains.ts); this module
 * only reads hosts, so reroute is the same everywhere and the server gate
 * decides whether a subdomain request is served at all.
 */
import { classifyPath } from '@iksi/core';

export const APEX = 'iksi.app';
export const WWW_HOST = `www.${APEX}`;
export const WWW_ORIGIN = `https://${WWW_HOST}`;

/**
 * Handles nobody may claim: infrastructure hostnames (they would shadow a real
 * `<name>.iksi.app`) and words the app uses for its own pages. The single
 * source for validateHandle and for which hosts count as a profile subdomain.
 */
export const RESERVED_HANDLES: readonly string[] = Object.freeze([
  // Hostnames
  'www', 'admin', 'api', 'cdn', 'app', 'mail', 'email', 'webmail', 'smtp', 'imap', 'pop', 'ftp',
  'ns1', 'ns2', 'ns3', 'ns4', 'mta-sts', 'autodiscover', 'autoconfig', 'status', 'blog', 'docs',
  'static', 'assets', 'media', 'dev', 'staging', 'test', 'beta', 'internal',
  // App words
  'root', 'help', 'support', 'about', 'terms', 'privacy', 'auth', 'login', 'signup', 'logout',
  'dashboard', 'settings', 'links', 'account'
]);

const RESERVED = new Set(RESERVED_HANDLES);

export const isReservedHandle = (handle: string): boolean => RESERVED.has(handle);

/**
 * A claimable handle that is also a valid hostname label: 3-30 of [a-z0-9-],
 * no hyphen at either end, and no `--` in positions 3-4 (IDNA, e.g. `xn--`).
 */
const LABEL = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/** Whether `handle` gets `<handle>.iksi.app`. Handles with `_` or an edge hyphen stay on www. */
export function hasSubdomain(handle: string): boolean {
  return LABEL.test(handle) && handle.slice(2, 4) !== '--' && !RESERVED.has(handle);
}

/**
 * The profile handle a request host names, or null. Only a single label under
 * iksi.app (or, in dev, under localhost) that could be a handle and is not
 * reserved; www, admin, cdn and the apex are never profiles.
 */
export function subdomainHandleOf(host: string, dev = false): string | null {
  const bare = host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  let label: string;
  if (bare.endsWith(`.${APEX}`)) label = bare.slice(0, -(APEX.length + 1));
  else if (dev && bare.endsWith('.localhost')) label = bare.slice(0, -'.localhost'.length);
  else return null;
  return hasSubdomain(label) ? label : null;
}

/**
 * The route a subdomain request renders: `/` is the profile, `/<name>` and
 * `/<name>+` are links in the owner's namespace. Anything the app owns (assets,
 * /_app, /media, /api, files) keeps its own path. Undefined means unchanged.
 */
export function subdomainReroute(url: URL, dev = false): string | undefined {
  const handle = subdomainHandleOf(url.host, dev);
  if (!handle) return undefined;
  if (url.pathname === '/') return `/@${handle}`;
  return classifyPath(url.pathname).kind === 'slug' ? `/@${handle}${url.pathname}` : undefined;
}

/** The path a request was routed by (`event.url` keeps the one the visitor asked for). */
export function routedPathname(url: URL, dev = false): string {
  return subdomainReroute(url, dev) ?? url.pathname;
}

/** Canonical address of a profile. */
export function profileUrl(handle: string, subdomains: boolean): string {
  return subdomains && hasSubdomain(handle) ? `https://${handle}.${APEX}/` : `${WWW_ORIGIN}/@${handle}`;
}

/** How a profile address is shown in text. */
export function profileLabel(handle: string, subdomains: boolean): string {
  return subdomains && hasSubdomain(handle) ? `${handle}.${APEX}` : `${APEX}/@${handle}`;
}

/**
 * Read-only check of existing handles before switching subdomains on: which
 * ones are now reserved, and which cannot be hostnames (they keep www/@handle).
 */
export function handleSubdomainReport(handles: Iterable<string>): { reserved: string[]; noSubdomain: string[] } {
  const reserved: string[] = [];
  const noSubdomain: string[] = [];
  for (const h of handles) {
    if (RESERVED.has(h)) reserved.push(h);
    else if (!hasSubdomain(h)) noSubdomain.push(h);
  }
  return { reserved, noSubdomain };
}
