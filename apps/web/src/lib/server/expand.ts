import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dns from 'node:dns';

/**
 * Follows a link's HTTP redirects from the server, one hop at a time, for the
 * URL expander tool. Anyone can paste anything here, so it must never become
 * a way to reach the server's own network (SSRF):
 *
 * - Only http and https on the default ports, and no user:pass@ in any hop.
 * - Every address is checked at connect time: the socket's own `lookup` resolves
 *   the host and refuses it if any address is private, so a DNS answer cannot
 *   change between the check and the connect. Node never calls `lookup` for an
 *   IP literal, so those are checked before the request is made.
 * - HEAD first (GET only when HEAD is refused), and the body is never read.
 *   No cookies or credentials are sent, and no page is loaded, so no scripts run.
 */

export type LookupFn = (hostname: string) => Promise<{ address: string; family: number }[]>;
export type ExpandStop = 'blocked' | 'too-many-hops' | 'timeout' | 'bad-url' | 'error';
export interface ExpandHop {
  url: string;
  status: number;
}
export interface Expansion {
  hops: ExpandHop[];
  final: string | null;
  stopped: null | ExpandStop;
}
export interface ExpandOptions {
  maxHops?: number;
  timeoutMs?: number;
  lookup?: LookupFn;
  /**
   * Tests only: lets 127.0.0.0/8 and ::1 through, and any port, so tests can
   * reach a local server. Every other address stays blocked. The API route
   * never passes it.
   */
  allowLoopbackForTest?: boolean;
}

export const MAX_HOPS = 10;
export const HOP_TIMEOUT_MS = 5000;
const MAX_URL_LENGTH = 2048;
const USER_AGENT = 'iksi-url-expander';
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const DEFAULT_PORTS = new Set(['', '80', '443']);

const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4] // reserved, includes 255.255.255.255
];
const V6_BLOCKED: [string, number][] = [
  ['::', 96], // unspecified (::), loopback (::1), IPv4-compatible
  ['::ffff:0:0:0', 96], // IPv4-translated
  ['64:ff9b::', 96], // NAT64, reaches IPv4 through a gateway
  ['64:ff9b:1::', 48], // local NAT64
  ['100::', 64], // discard
  ['2001::', 32], // Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local (deprecated, still private)
  ['ff00::', 8] // multicast
];

// Kept apart by family on purpose: a BlockList checks an IPv4 address against
// its IPv6 rules as ::ffff:a.b.c.d, so one shared list holding ::ffff:0:0/96
// would block every IPv4 address.
const blocked4 = new net.BlockList();
for (const [a, p] of V4_BLOCKED) blocked4.addSubnet(a, p, 'ipv4');
const blocked6 = new net.BlockList();
for (const [a, p] of V6_BLOCKED) blocked6.addSubnet(a, p, 'ipv6');
const mapped6 = new net.BlockList();
mapped6.addSubnet('::ffff:0:0', 96, 'ipv6');
const loopback4 = new net.BlockList();
loopback4.addSubnet('127.0.0.0', 8, 'ipv4');
const loopback6 = new net.BlockList();
loopback6.addAddress('::1', 'ipv6');

/**
 * True when the expander must not connect to this address. Anything that is
 * not a plain IP (a zone id, garbage from a resolver) is blocked too. IPv4-mapped
 * IPv6 (::ffff:a.b.c.d) is blocked outright: a public site has no reason to
 * resolve to one, and it is how private IPv4 addresses hide in IPv6 form.
 */
export function isBlockedAddress(address: string, allowLoopbackForTest = false): boolean {
  if (typeof address !== 'string' || address.includes('%')) return true;
  const family = net.isIP(address);
  try {
    if (family === 4) {
      if (allowLoopbackForTest && loopback4.check(address, 'ipv4')) return false;
      return blocked4.check(address, 'ipv4');
    }
    if (family === 6) {
      if (mapped6.check(address, 'ipv6')) return true;
      if (allowLoopbackForTest && loopback6.check(address, 'ipv6')) return false;
      return blocked6.check(address, 'ipv6');
    }
  } catch {
    return true;
  }
  return true;
}

/** A pasted link as a URL; a bare host gets https://. Null when unusable. */
function parseInput(input: unknown): URL | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/** The host without IPv6 brackets, as a socket wants it. */
const bareHost = (url: URL) => url.hostname.replace(/^\[|\]$/g, '');

/** What is wrong with a hop before any request is made, or null. Runs on every hop. */
function refuse(url: URL, allowLoopbackForTest: boolean): 'bad-url' | 'blocked' | null {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'bad-url';
  if (url.username !== '' || url.password !== '') return 'bad-url';
  if (!allowLoopbackForTest && !DEFAULT_PORTS.has(url.port)) return 'bad-url';
  if (url.href.length > MAX_URL_LENGTH) return 'bad-url';
  const host = bareHost(url);
  if (!host) return 'bad-url';
  // WHATWG parsing already turned 2130706433, 0x7f.1 and friends into 127.0.0.1.
  if (net.isIP(host) !== 0 && isBlockedAddress(host, allowLoopbackForTest)) return 'blocked';
  return null;
}

class HopError extends Error {
  constructor(readonly stop: ExpandStop) {
    super(stop);
  }
}

const systemLookup: LookupFn = (hostname) => dns.promises.lookup(hostname, { all: true });

type LookupCallback = (err: Error | null, address?: string | dns.LookupAddress[], family?: number) => void;

/**
 * The socket's `lookup`: resolves every address, refuses the host if any one is
 * blocked, and hands back only checked addresses. Node may ask for all of them
 * (`all: true`, used by autoSelectFamily) or for one.
 */
function guardedLookup(resolve: LookupFn, allowLoopbackForTest: boolean) {
  return (hostname: string, options: dns.LookupOptions, callback: LookupCallback) => {
    resolve(hostname).then(
      (raw) => {
        const addresses = (Array.isArray(raw) ? raw : []).map((a) => ({
          address: String(a?.address),
          family: net.isIP(String(a?.address))
        }));
        if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address, allowLoopbackForTest))) {
          return callback(new HopError('blocked'));
        }
        const family = options?.family === 4 || options?.family === 6 ? options.family : 0;
        const usable = family ? addresses.filter((a) => a.family === family) : addresses;
        if (usable.length === 0) return callback(Object.assign(new Error('no address'), { code: 'ENOTFOUND' }));
        if (options?.all) callback(null, usable);
        else callback(null, usable[0].address, usable[0].family);
      },
      (err) => callback(err instanceof Error ? err : new Error(String(err)))
    );
  };
}

/** One request; resolves with the status and Location as soon as headers arrive. */
function headersOf(
  url: URL,
  method: 'HEAD' | 'GET',
  msLeft: number,
  lookup: ReturnType<typeof guardedLookup>
): Promise<{ status: number; location: string | undefined }> {
  return new Promise((resolve, reject) => {
    const secure = url.protocol === 'https:';
    const req = (secure ? https : http).request(
      {
        protocol: url.protocol,
        hostname: bareHost(url),
        port: url.port || (secure ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: { 'user-agent': USER_AGENT, accept: '*/*' },
        // A fresh socket per request, so every connect goes through the lookup.
        agent: false,
        lookup
      },
      (res) => {
        clearTimeout(timer);
        const location = typeof res.headers.location === 'string' ? res.headers.location : undefined;
        // The body is never read: drop the socket now.
        res.destroy();
        req.destroy();
        resolve({ status: res.statusCode ?? 0, location });
      }
    );
    const timer = setTimeout(() => req.destroy(new HopError('timeout')), Math.max(0, msLeft));
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.end();
  });
}

const stopOf = (err: unknown): ExpandStop => (err instanceof HopError ? err.stop : 'error');

export async function expandURL(input: string, opts: ExpandOptions = {}): Promise<Expansion> {
  const maxHops = opts.maxHops ?? MAX_HOPS;
  const timeoutMs = opts.timeoutMs ?? HOP_TIMEOUT_MS;
  const allowLoopback = opts.allowLoopbackForTest === true;
  const lookup = guardedLookup(opts.lookup ?? systemLookup, allowLoopback);
  const hops: ExpandHop[] = [];
  const stop = (stopped: ExpandStop): Expansion => ({ hops, final: null, stopped });

  let current = parseInput(input);
  if (!current) return stop('bad-url');

  for (;;) {
    const refused = refuse(current, allowLoopback);
    if (refused) return stop(refused);
    if (hops.length >= maxHops) return stop('too-many-hops');

    let res: { status: number; location: string | undefined };
    try {
      const deadline = Date.now() + timeoutMs;
      res = await headersOf(current, 'HEAD', timeoutMs, lookup);
      if (res.status === 405 || res.status === 501) {
        res = await headersOf(current, 'GET', deadline - Date.now(), lookup);
      }
    } catch (err) {
      return stop(stopOf(err));
    }

    hops.push({ url: current.href, status: res.status });
    if (!REDIRECTS.has(res.status) || !res.location) return { hops, final: current.href, stopped: null };
    try {
      current = new URL(res.location, current);
    } catch {
      return stop('bad-url');
    }
  }
}
