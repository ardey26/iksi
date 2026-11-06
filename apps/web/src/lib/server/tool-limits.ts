import { json } from '@sveltejs/kit';
import { rateLimit } from '#lib/rateLimit.js';
import { clientIpHash } from '#lib/server/client.js';
import { checkURL, type SafeVerdict } from '#lib/server/safe-browsing.js';

/**
 * Limits for the free public tools (/tools/link-checker, /tools/url-expander).
 * Link creation depends on the same Safe Browsing key, so the tools get their
 * own daily budget and can never spend it. The limiter fails closed: when the
 * database cannot count, a tool refuses rather than calling Google.
 */

export type Tool = 'check' | 'expand';
export type ToolVerdict = SafeVerdict | 'unavailable';

export const TOOL_LIMIT = { requests: 20, windowMs: 3_600_000 } as const;
export const SAFE_BROWSING_BUDGET = { id: 'tools:sb:daily', requests: 2000, windowMs: 86_400_000 } as const;
export const TOOL_BODY_BYTES = 4 * 1024;
export const TOOL_URL_LENGTH = 2048;

const TOO_MANY = 'Too many checks. Try again in an hour.';

/** Per-visitor allowance, keyed by a hash of the IP. */
export async function toolAllowed(
  event: { request: Request; getClientAddress?: () => string },
  tool: Tool
): Promise<{ ok: true } | { ok: false; status: 429; error: string }> {
  let hash: string;
  try {
    hash = clientIpHash(event);
  } catch {
    return { ok: false, status: 429, error: TOO_MANY };
  }
  const { allowed } = await rateLimit(`tools:${tool}:${hash}`, TOOL_LIMIT.requests, TOOL_LIMIT.windowMs);
  return allowed ? { ok: true } : { ok: false, status: 429, error: TOO_MANY };
}

/**
 * A Safe Browsing verdict for a tool, counted against the tools' shared daily
 * budget. Over budget, or when the lookup could not be made: 'unavailable'.
 */
export async function toolSafeBrowsing(url: string): Promise<ToolVerdict> {
  const { allowed } = await rateLimit(SAFE_BROWSING_BUDGET.id, SAFE_BROWSING_BUDGET.requests, SAFE_BROWSING_BUDGET.windowMs);
  if (!allowed) return 'unavailable';
  const verdict = await checkURL(url);
  return verdict === 'pending' ? 'unavailable' : verdict;
}

export const SAFE_BROWSING_WAIT_MS = 3000;

/**
 * toolSafeBrowsing, but never waiting more than SAFE_BROWSING_WAIT_MS: a slow
 * Google answer becomes 'unavailable' instead of holding the function.
 * checkURL itself is left alone, since link creation shares it.
 */
export function toolSafeBrowsingWithin(url: string, ms = SAFE_BROWSING_WAIT_MS): Promise<ToolVerdict> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<ToolVerdict>((resolve) => {
    timer = setTimeout(() => resolve('unavailable'), ms);
  });
  return Promise.race([toolSafeBrowsing(url), late]).finally(() => clearTimeout(timer));
}

/** An http(s) URL for a pasted link (a bare host gets https://), or null. */
export function toolURL(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > TOOL_URL_LENGTH) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

const NO_STORE = { 'cache-control': 'no-store' };

/** A JSON tool response; never cached. */
export const toolJSON = (body: unknown, status = 200) => json(body, { status, headers: NO_STORE });

/**
 * The `url` from a tool request's `{ url }` body, reading at most
 * TOOL_BODY_BYTES whatever the content-length says. Null for anything else.
 */
export async function readToolURL(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > TOOL_BODY_BYTES) return null;
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > TOOL_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    return body && typeof body === 'object' && typeof body.url === 'string' ? body.url : null;
  } catch {
    return null;
  }
}
