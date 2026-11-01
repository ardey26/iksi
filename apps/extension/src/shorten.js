// Pure logic shared by the background worker, the popup and the options page.
// No chrome.* calls here, so it runs under vitest as is.

export const API_ORIGIN = 'https://www.iksi.app';
const SHORTEN_ENDPOINT = `${API_ORIGIN}/api/shorten`;
export const DASHBOARD_URL = `${API_ORIGIN}/dashboard`;

/** Same limit the server applies. */
const MAX_URL_LENGTH = 2048;
const KEY_RE = /^iksi_[A-Za-z0-9_-]{43}$/;
const KEY_ANYWHERE = /iksi_[A-Za-z0-9_-]{8,}/g;

export const MENU = {
  link: { id: 'iksi-shorten-link', title: 'Shorten link with iksi', contexts: ['link'] },
  page: { id: 'iksi-shorten-page', title: 'Shorten this page with iksi', contexts: ['page'] }
};

export const ERRORS = {
  no_key: 'Connect the extension to iksi in its options.',
  bad_key: 'iksi did not accept your key. It may have been disconnected. Connect again in the extension options.',
  rate_limited: 'Too many links at once. Wait a minute and try again.',
  bad_url: 'iksi cannot shorten that link.',
  unsupported: 'Only web pages (http and https) can be shortened.',
  network: 'Could not reach iksi. Check your connection and try again.',
  server: 'iksi had a problem. Try again in a moment.'
};

export function isKeyFormat(key) {
  return typeof key === 'string' && KEY_RE.test(key);
}

/** The only part of a key the extension ever shows. */
export function keyPrefix(key) {
  return `${String(key).slice(0, 9)}…`;
}

export function isShortenable(url) {
  if (typeof url !== 'string' || url.length === 0 || url.length > MAX_URL_LENGTH) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** The URL a context menu click is about, or null when the item is not ours. */
export function targetOf(info, tab) {
  if (info.menuItemId === MENU.link.id) return info.linkUrl ?? null;
  if (info.menuItemId === MENU.page.id) return info.pageUrl || tab?.url || null;
  return null;
}

export function buildShortenRequest(key, longURL) {
  return {
    url: SHORTEN_ENDPOINT,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ longURL }),
      // The key is the identity. The site's session cookie must not ride along.
      credentials: 'omit',
      cache: 'no-store'
    }
  };
}

export function shortLinkOf(slug) {
  return { url: `${API_ORIGIN}/${slug}`, label: `iksi.app/${slug}` };
}

const fail = (code, message = ERRORS[code]) => ({ ok: false, code, message });

function sentence(text) {
  const t = text.replace(KEY_ANYWHERE, 'your key').trim();
  if (!t) return '';
  const s = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

/** Turns an API answer into a short link or an error the user can act on. */
export function readShortenResponse(status, body) {
  const data = body && typeof body === 'object' ? body : {};
  if (status === 200 && typeof data.shortURL === 'string' && data.shortURL) {
    return { ok: true, ...shortLinkOf(data.shortURL) };
  }
  if (status === 401) return fail('bad_key');
  if (status === 429) return fail('rate_limited');
  if (status === 400 || status === 413) {
    return fail('bad_url', (typeof data.error === 'string' && sentence(data.error)) || ERRORS.bad_url);
  }
  return fail('server');
}

/** Shortens `url` with `key`. Never throws. */
export async function shortenUrl({ key, url, fetch }) {
  if (!key) return fail('no_key');
  if (!isKeyFormat(key)) return fail('bad_key');
  if (!isShortenable(url)) return fail('unsupported');

  const req = buildShortenRequest(key, url);
  let res;
  try {
    res = await fetch(req.url, req.init);
  } catch {
    return fail('network');
  }
  const body = await res.json().catch(() => null);
  return readShortenResponse(res.status, body);
}
