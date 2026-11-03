import { describe, it, expect, vi } from 'vitest';
import { ERRORS } from '../src/shorten.js';
import {
  PALETTE_TOKENS,
  PROFILE_ENDPOINT,
  applyPalette,
  buildProfileRequest,
  cacheOwner,
  fetchProfile,
  readCachedProfile,
  readProfile,
  readProfileResponse,
  refreshProfile,
  sameProfile
} from '../src/profile.js';

const KEY = 'iksi_' + 'Ab3-_'.repeat(8) + 'xyz';
const OTHER_KEY = 'iksi_' + 'Zz9-_'.repeat(8) + 'abc';

const TOKENS = {
  '--bg': 'oklch(from #3B82F6 0.2 0.02 h)',
  '--surface': 'oklch(from #3B82F6 0.23 0.01 h)',
  '--surface-2': 'oklch(from #3B82F6 0.265 0.014 h)',
  '--border': 'oklch(from #3B82F6 0.3 0.04 h)',
  '--text-primary': 'oklch(from #3B82F6 0.94 0.008 h)',
  '--text-muted': 'oklch(from #3B82F6 0.7 0.018 h)',
  '--accent': '#3B82F6'
};

const BODY = {
  handle: 'lilysbakery',
  displayName: "Lily's Bakery",
  avatarUrl: 'https://www.iksi.app/media/1/avatar/a.96.webp',
  profileUrl: 'https://lilysbakery.iksi.app',
  palette: { scheme: 'dark', tokens: TOKENS },
  links: [
    { title: 'Menu and prices', url: 'https://www.iksi.app/@lilysbakery/menu', path: '/menu' },
    { title: 'Order on Shopee', url: 'https://www.iksi.app/shop', path: '/shop' }
  ]
};

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: vi.fn(async (k) => (k in data ? { [k]: data[k] } : {})),
    set: vi.fn(async (o) => Object.assign(data, o)),
    remove: vi.fn(async (k) => void delete data[k])
  };
}

const respond = (status, body) => vi.fn(async () => ({ status, json: async () => body }));

describe('buildProfileRequest', () => {
  it('GETs the profile with the key and without cookies or cache', () => {
    const req = buildProfileRequest(KEY);
    expect(PROFILE_ENDPOINT).toBe('https://www.iksi.app/api/me/profile');
    expect(req.url).toBe(PROFILE_ENDPOINT);
    expect(req.init).toEqual({
      method: 'GET',
      headers: { Authorization: `Bearer ${KEY}` },
      credentials: 'omit',
      cache: 'no-store'
    });
  });
});

describe('readProfile', () => {
  it('keeps a well-formed profile and labels its link without the scheme', () => {
    expect(readProfile(BODY)).toEqual({
      handle: 'lilysbakery',
      displayName: "Lily's Bakery",
      avatarUrl: BODY.avatarUrl,
      profileUrl: 'https://lilysbakery.iksi.app',
      profileLabel: 'lilysbakery.iksi.app',
      palette: { scheme: 'dark', tokens: TOKENS },
      links: BODY.links
    });
  });

  it('labels a www profile link as www.iksi.app/@handle', () => {
    expect(readProfile({ ...BODY, profileUrl: 'https://www.iksi.app/@lilysbakery' }).profileLabel).toBe('www.iksi.app/@lilysbakery');
  });

  it('falls back to the handle when there is no display name', () => {
    expect(readProfile({ ...BODY, displayName: null }).displayName).toBe('lilysbakery');
    expect(readProfile({ ...BODY, displayName: '   ' }).displayName).toBe('lilysbakery');
  });

  it('without a handle has no profile link and no links', () => {
    const p = readProfile({ ...BODY, handle: null, profileUrl: null, links: [] });
    expect(p).toMatchObject({ handle: null, profileUrl: null, profileLabel: null, links: [] });
    expect(readProfile({ ...BODY, handle: null })).toMatchObject({ profileUrl: null, links: [] });
  });

  it('accepts a data: image avatar and drops any other kind', () => {
    expect(readProfile({ ...BODY, avatarUrl: 'data:image/webp;base64,AAAA' }).avatarUrl).toBe('data:image/webp;base64,AAAA');
    expect(readProfile({ ...BODY, avatarUrl: 'javascript:alert(1)' }).avatarUrl).toBeNull();
    expect(readProfile({ ...BODY, avatarUrl: 'http://www.iksi.app/a.webp' }).avatarUrl).toBeNull();
    expect(readProfile({ ...BODY, avatarUrl: 'data:text/html,hi' }).avatarUrl).toBeNull();
    expect(readProfile({ ...BODY, avatarUrl: null }).avatarUrl).toBeNull();
  });

  it('drops a profile link that is not https', () => {
    expect(readProfile({ ...BODY, profileUrl: 'javascript:alert(1)' })).toMatchObject({ profileUrl: null, profileLabel: null });
  });

  it('keeps links in order and drops malformed rows', () => {
    const links = [
      { title: 'Good', url: 'https://www.iksi.app/@lilysbakery/good', path: '/good' },
      { title: '', url: 'https://www.iksi.app/x', path: '/x' },
      { title: 'Not https', url: 'http://www.iksi.app/x', path: '/x' },
      { title: 'Script', url: 'javascript:alert(1)', path: '/x' },
      null,
      'nope',
      { title: 'No path', url: 'https://www.iksi.app/@lilysbakery/sale' },
      { title: 'Also good', url: 'https://www.iksi.app/z', path: '/z' }
    ];
    expect(readProfile({ ...BODY, links }).links).toEqual([
      { title: 'Good', url: 'https://www.iksi.app/@lilysbakery/good', path: '/good' },
      { title: 'No path', url: 'https://www.iksi.app/@lilysbakery/sale', path: '/sale' },
      { title: 'Also good', url: 'https://www.iksi.app/z', path: '/z' }
    ]);
    expect(readProfile({ ...BODY, links: 'nope' }).links).toEqual([]);
  });

  it('keeps only the known palette tokens with plain color values', () => {
    const tokens = { ...TOKENS, '--error': 'red', '--text-muted': 'red; background: url(x)', '--accent': '}', '--surface-2': 'URL(https//x)' };
    const p = readProfile({ ...BODY, palette: { scheme: 'light', tokens } });
    expect(p.palette.scheme).toBe('light');
    expect(Object.keys(p.palette.tokens).sort()).toEqual(
      ['--bg', '--surface', '--border', '--text-primary'].sort()
    );
  });

  it('has no palette when the scheme or tokens are unusable', () => {
    expect(readProfile({ ...BODY, palette: { scheme: 'sepia', tokens: TOKENS } }).palette).toBeNull();
    expect(readProfile({ ...BODY, palette: { scheme: 'dark', tokens: {} } }).palette).toBeNull();
    expect(readProfile({ ...BODY, palette: null }).palette).toBeNull();
  });

  it('rejects something that is not a profile', () => {
    expect(readProfile(null)).toBeNull();
    expect(readProfile('nope')).toBeNull();
    expect(readProfile({ error: 'x' })).toBeNull();
  });
});

describe('readProfileResponse', () => {
  it('reads a 200 into a profile', () => {
    expect(readProfileResponse(200, BODY)).toEqual({ ok: true, profile: readProfile(BODY) });
  });

  it.each([
    [401, { error: 'Invalid API key' }, 'bad_key'],
    [429, { error: 'slow down' }, 'rate_limited'],
    [500, null, 'server'],
    [200, { nope: true }, 'server']
  ])('%i → %s', (status, body, code) => {
    expect(readProfileResponse(status, body)).toEqual({ ok: false, code, message: ERRORS[code] });
  });
});

describe('fetchProfile', () => {
  it('asks iksi for the profile with the key', async () => {
    const fetch = respond(200, BODY);
    expect(await fetchProfile({ key: KEY, fetch })).toMatchObject({ ok: true });
    const req = buildProfileRequest(KEY);
    expect(fetch).toHaveBeenCalledWith(req.url, req.init);
  });

  it('never sends a missing or malformed key', async () => {
    const fetch = vi.fn();
    expect(await fetchProfile({ key: undefined, fetch })).toMatchObject({ ok: false, code: 'no_key' });
    expect(await fetchProfile({ key: 'iksi_nope', fetch })).toMatchObject({ ok: false, code: 'bad_key' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports a failed request as network, and a body that is not JSON as server', async () => {
    expect(await fetchProfile({ key: KEY, fetch: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) })).toMatchObject({
      code: 'network'
    });
    const notJson = vi.fn(async () => ({ status: 200, json: async () => Promise.reject(new SyntaxError('x')) }));
    expect(await fetchProfile({ key: KEY, fetch: notJson })).toMatchObject({ code: 'server' });
  });
});

describe('the cached profile', () => {
  it('is tied to the key by a hash, never the key itself', async () => {
    const owner = await cacheOwner(KEY);
    expect(owner).toMatch(/^[0-9a-f]{64}$/);
    expect(owner).not.toBe(await cacheOwner(OTHER_KEY));
  });

  it('is saved on a fresh answer, and read back for the same key only', async () => {
    const storage = fakeStorage();
    const r = await refreshProfile({ key: KEY, storage, fetch: respond(200, BODY) });
    expect(r).toEqual({ ok: true, profile: readProfile(BODY) });
    expect(JSON.stringify(storage.data)).not.toContain(KEY);
    expect(await readCachedProfile({ key: KEY, storage })).toEqual(readProfile(BODY));
    expect(await readCachedProfile({ key: OTHER_KEY, storage })).toBeNull();
  });

  it('is kept when iksi cannot be reached or is busy', async () => {
    const storage = fakeStorage();
    await refreshProfile({ key: KEY, storage, fetch: respond(200, BODY) });
    await refreshProfile({ key: KEY, storage, fetch: vi.fn().mockRejectedValue(new TypeError('x')) });
    await refreshProfile({ key: KEY, storage, fetch: respond(429, {}) });
    await refreshProfile({ key: KEY, storage, fetch: respond(500, null) });
    expect(await readCachedProfile({ key: KEY, storage })).toEqual(readProfile(BODY));
  });

  it('is removed when iksi no longer accepts the key', async () => {
    const storage = fakeStorage();
    await refreshProfile({ key: KEY, storage, fetch: respond(200, BODY) });
    expect(await refreshProfile({ key: KEY, storage, fetch: respond(401, {}) })).toMatchObject({ ok: false, code: 'bad_key' });
    expect(await readCachedProfile({ key: KEY, storage })).toBeNull();
  });

  it('is re-checked when read, and anything odd in it is ignored', async () => {
    const owner = await cacheOwner(KEY);
    const odd = fakeStorage({ profile: { owner, profile: { ...BODY, avatarUrl: 'javascript:x' } } });
    expect((await readCachedProfile({ key: KEY, storage: odd })).avatarUrl).toBeNull();
    expect(await readCachedProfile({ key: KEY, storage: fakeStorage({ profile: 'junk' }) })).toBeNull();
    expect(await readCachedProfile({ key: KEY, storage: fakeStorage() })).toBeNull();
    expect(await readCachedProfile({ key: undefined, storage: odd })).toBeNull();
  });

  it('never throws, even when storage fails', async () => {
    const broken = { get: vi.fn().mockRejectedValue(new Error('x')), set: vi.fn().mockRejectedValue(new Error('x')), remove: vi.fn().mockRejectedValue(new Error('x')) };
    expect(await readCachedProfile({ key: KEY, storage: broken })).toBeNull();
    expect(await refreshProfile({ key: KEY, storage: broken, fetch: respond(200, BODY) })).toMatchObject({ ok: true });
    expect(await refreshProfile({ key: KEY, storage: broken, fetch: respond(401, {}) })).toMatchObject({ code: 'bad_key' });
  });
});

describe('sameProfile', () => {
  it('tells a changed profile from an unchanged one', () => {
    expect(sameProfile(readProfile(BODY), readProfile(structuredClone(BODY)))).toBe(true);
    expect(sameProfile(readProfile(BODY), readProfile({ ...BODY, displayName: 'Lily' }))).toBe(false);
    expect(sameProfile(null, readProfile(BODY))).toBe(false);
  });
});

describe('applyPalette', () => {
  const fakeRoot = () => {
    const props = {};
    return { props, style: { setProperty: vi.fn((k, v) => (props[k] = v)), removeProperty: vi.fn((k) => delete props[k]) } };
  };

  it('sets every token and the color scheme on the root', () => {
    const root = fakeRoot();
    applyPalette(root, { scheme: 'light', tokens: TOKENS });
    expect(root.props).toEqual({ ...TOKENS, 'color-scheme': 'light' });
  });

  it('puts back the stylesheet defaults when there is no palette', () => {
    const root = fakeRoot();
    applyPalette(root, { scheme: 'dark', tokens: TOKENS });
    applyPalette(root, null);
    expect(root.props).toEqual({});
    for (const t of [...PALETTE_TOKENS, 'color-scheme']) expect(root.style.removeProperty).toHaveBeenCalledWith(t);
  });

  it('clears a token the new palette leaves out', () => {
    const root = fakeRoot();
    applyPalette(root, { scheme: 'dark', tokens: TOKENS });
    applyPalette(root, { scheme: 'dark', tokens: { '--bg': '#000' } });
    expect(root.props).toEqual({ '--bg': '#000', 'color-scheme': 'dark' });
  });
});
