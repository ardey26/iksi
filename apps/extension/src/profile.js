// The popup's profile section: who the key belongs to, their profile's
// palette and the links it shows. Pure logic: fetch, storage and the root
// element are passed in, so it runs under vitest as is.
import { API_ORIGIN, ERRORS, isKeyFormat } from './shorten.js';

export const PROFILE_ENDPOINT = `${API_ORIGIN}/api/me/profile`;
export const PALETTE_TOKENS = ['--bg', '--surface', '--surface-2', '--border', '--text-primary', '--text-muted', '--accent'];

const CACHE_KEY = 'profile';
const MAX_LINKS = 200;
// A CSS color, including oklch(from <color> L C h). Nothing that could end
// the declaration or open a url().
const COLOR_RE = /^(?!.*url\()[a-z0-9#%.,()\s/+-]{1,200}$/i;

const fail = (code) => ({ ok: false, code, message: ERRORS[code] });

export function buildProfileRequest(key) {
  return {
    url: PROFILE_ENDPOINT,
    init: {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      // The key is the identity. The site's session cookie must not ride along.
      credentials: 'omit',
      cache: 'no-store'
    }
  };
}

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function httpsUrl(v) {
  if (typeof v !== 'string') return null;
  try {
    return new URL(v).protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}

function avatarOf(v) {
  if (typeof v === 'string' && /^data:image\/(png|jpeg|webp|gif|avif);/i.test(v)) return v;
  return httpsUrl(v);
}

function pathOf(path, url) {
  if (typeof path === 'string' && /^\/[^\s/]+$/.test(path)) return path;
  const last = new URL(url).pathname.split('/').filter(Boolean).pop();
  return last ? `/${last}` : null;
}

function linksOf(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows.slice(0, MAX_LINKS)) {
    if (!row || typeof row !== 'object') continue;
    const title = text(row.title);
    const url = httpsUrl(row.url);
    const path = url && pathOf(row.path, url);
    if (title && url && path) out.push({ title, url, path });
  }
  return out;
}

function paletteOf(p) {
  if (!p || typeof p !== 'object' || (p.scheme !== 'dark' && p.scheme !== 'light')) return null;
  const tokens = {};
  for (const name of PALETTE_TOKENS) {
    const v = p.tokens?.[name];
    if (typeof v === 'string' && COLOR_RE.test(v)) tokens[name] = v;
  }
  return Object.keys(tokens).length ? { scheme: p.scheme, tokens } : null;
}

/** Checks a profile answer (or a cached one). Null when it is not a profile. */
export function readProfile(body) {
  if (!body || typeof body !== 'object' || !('handle' in body)) return null;
  const handle = text(body.handle);
  const profileUrl = handle ? httpsUrl(body.profileUrl) : null;
  return {
    handle,
    displayName: text(body.displayName) ?? handle,
    avatarUrl: avatarOf(body.avatarUrl),
    profileUrl,
    profileLabel: profileUrl ? profileUrl.replace(/^https:\/\//, '').replace(/\/$/, '') : null,
    palette: paletteOf(body.palette),
    links: handle ? linksOf(body.links) : []
  };
}

export function readProfileResponse(status, body) {
  if (status === 200) {
    const profile = readProfile(body);
    return profile ? { ok: true, profile } : fail('server');
  }
  if (status === 401) return fail('bad_key');
  if (status === 429) return fail('rate_limited');
  return fail('server');
}

/** Fetches the profile for `key`. Never throws. */
export async function fetchProfile({ key, fetch }) {
  if (!key) return fail('no_key');
  if (!isKeyFormat(key)) return fail('bad_key');
  const req = buildProfileRequest(key);
  let res;
  try {
    res = await fetch(req.url, req.init);
  } catch {
    return fail('network');
  }
  const body = await res.json().catch(() => null);
  return readProfileResponse(res.status, body);
}

/** SHA-256 of the key, hex: ties the cache to one key without storing it. */
export async function cacheOwner(key) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The last profile seen with this key, or null. Never throws. */
export async function readCachedProfile({ key, storage }) {
  if (!key) return null;
  try {
    const { [CACHE_KEY]: cached } = await storage.get(CACHE_KEY);
    if (!cached || typeof cached !== 'object' || cached.owner !== (await cacheOwner(key))) return null;
    return readProfile(cached.profile);
  } catch {
    return null;
  }
}

/** Fetches a fresh profile and keeps the cache in step. Never throws. */
export async function refreshProfile({ key, storage, fetch }) {
  const result = await fetchProfile({ key, fetch });
  try {
    if (result.ok) await storage.set({ [CACHE_KEY]: { owner: await cacheOwner(key), profile: result.profile } });
    else if (result.code === 'bad_key') await storage.remove(CACHE_KEY);
  } catch {
    // The cache is only a head start for the next open.
  }
  return result;
}

export function sameProfile(a, b) {
  return !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
}

/** Puts the profile's palette on the root, or the stylesheet defaults back. */
export function applyPalette(root, palette) {
  for (const name of PALETTE_TOKENS) {
    const v = palette?.tokens?.[name];
    if (v) root.style.setProperty(name, v);
    else root.style.removeProperty(name);
  }
  if (palette) root.style.setProperty('color-scheme', palette.scheme);
  else root.style.removeProperty('color-scheme');
}
