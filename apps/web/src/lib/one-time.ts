import { isValidURL } from './utils/urlValidation.js';

/** Shared by the server and the create forms; safe to import on the client. */

/** Longest text a one-time link may hold. */
export const ONE_TIME_TEXT_MAX = 2000;

/** Unopened one-time links expire this long after they are made. */
export const ONE_TIME_TTL_DAYS = 7;
export const ONE_TIME_TTL_MS = ONE_TIME_TTL_DAYS * 24 * 60 * 60 * 1000;

export type OneTimeKind = 'url' | 'text';

export interface OneTimeRequest {
  kind: OneTimeKind;
  content: string;
  password?: string;
}

/** Client-side gate for the create button; the server validates again. */
export function oneTimeContentValid(kind: OneTimeKind, content: string): boolean {
  if (kind === 'url') return content.trim() !== '' && isValidURL(content);
  return content.trim() !== '' && content.length <= ONE_TIME_TEXT_MAX;
}

export type OneTimeCreated = {
  ok: true;
  shortURL: string;
  link: Record<string, unknown> | null;
};

/** Creates a one-time link through /api/shorten. */
export async function createOneTimeLink(
  req: OneTimeRequest
): Promise<OneTimeCreated | { ok: false; error: string }> {
  const oneTime: OneTimeRequest = { kind: req.kind, content: req.content };
  if (req.password) oneTime.password = req.password;
  try {
    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ oneTime })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || typeof body.shortURL !== 'string') {
      return { ok: false, error: body.error || 'Something went wrong' };
    }
    return { ok: true, shortURL: body.shortURL, link: body.link ?? null };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}
