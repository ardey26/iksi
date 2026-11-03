import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const findUnique = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const authenticateApiKey = vi.hoisted(() => vi.fn());

vi.mock('#lib/prisma.js', () => ({ prisma: { user: { findUnique } } }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit }));
vi.mock('#lib/server/api-keys.js', async (orig) => ({
  ...(await orig<typeof import('#lib/server/api-keys.js')>()),
  authenticateApiKey
}));

import { GET, OPTIONS } from './+server';
import { API_KEY_RATE } from '#lib/server/api-keys.js';
import { PUBLIC_ROW_WHERE } from '#lib/server/profile-rows.js';
import { profilePalette } from '#lib/profile-palette.js';

const KEY = 'iksi_' + 'k'.repeat(43);
const EXT = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

const row = (title: string, shortURL: string | null, oneTime = false) => ({
  title,
  link: shortURL === null ? null : { shortURL, oneTime }
});

const lily = () => ({
  handle: { handle: 'lilysbakery' },
  profile: {
    displayName: "Lily's Bakery",
    avatarUrl: 'https://cdn.iksi.app/42/avatar/0f8fad5b-d9cb-469f-a165-70867728950e.400.webp',
    theme: '90',
    accent: '#EF4444',
    rows: [
      row('Menu and prices', '@lilysbakery/menu'),
      row('Weekend sale', 'sale'),
      row('Gift card', 'gift1', true),
      row('Gone', null)
    ]
  }
});

function get(headers: Record<string, string> = { authorization: `Bearer ${KEY}` }) {
  const request = new Request('https://www.iksi.app/api/me/profile', { headers });
  return GET({ request } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ allowed: true });
  authenticateApiKey.mockResolvedValue({ id: 7, userId: 42 });
  findUnique.mockResolvedValue(lily());
  vi.stubEnv('MEDIA_BASE_URL', 'https://www.iksi.app/media');
  vi.stubEnv('SUBDOMAINS_ENABLED', 'false');
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/me/profile', () => {
  it("returns the key owner's profile, palette and public links", async () => {
    const res = await get({ authorization: `Bearer ${KEY}`, origin: EXT });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('access-control-allow-origin')).toBe(EXT);
    expect(res.headers.get('vary')).toContain('Origin');
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: 42 });

    const { palette, ...rest } = await res.json();
    expect(rest).toEqual({
      handle: 'lilysbakery',
      displayName: "Lily's Bakery",
      avatarUrl: 'https://www.iksi.app/media/42/avatar/0f8fad5b-d9cb-469f-a165-70867728950e.400.webp',
      profileUrl: 'https://www.iksi.app/@lilysbakery',
      links: [
        { title: 'Menu and prices', url: 'https://www.iksi.app/@lilysbakery/menu', path: '/menu' },
        { title: 'Weekend sale', url: 'https://www.iksi.app/sale', path: '/sale' }
      ]
    });

    const full = profilePalette('#EF4444', '90');
    expect(palette.scheme).toBe('light');
    expect(Object.keys(palette.tokens).sort()).toEqual(
      ['--accent', '--bg', '--border', '--surface', '--surface-2', '--text-muted', '--text-primary'].sort()
    );
    for (const [k, v] of Object.entries(palette.tokens)) expect(v).toBe(full.tokens[k]);
  });

  it('reads rows the way the public profile does', async () => {
    await get();
    const rows = findUnique.mock.calls[0][0].select.profile.select.rows;
    expect(rows.where).toEqual(PUBLIC_ROW_WHERE);
    expect(rows.orderBy).toEqual({ position: 'asc' });
  });

  it('shares the subdomain address once subdomains are on', async () => {
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    const body = await (await get()).json();
    expect(body.profileUrl).toBe('https://lilysbakery.iksi.app/');
  });

  it('passes a data: avatar through as it is', async () => {
    const u = lily();
    u.profile.avatarUrl = 'data:image/png;base64,AAAA';
    findUnique.mockResolvedValue(u);
    expect((await (await get()).json()).avatarUrl).toBe('data:image/png;base64,AAAA');
  });

  it('has no profile address and no links without a handle', async () => {
    findUnique.mockResolvedValue({ ...lily(), handle: null });
    const body = await (await get()).json();
    expect(body).toMatchObject({ handle: null, profileUrl: null, links: [], displayName: "Lily's Bakery" });
  });

  it('answers a user who never set up a profile with the default palette', async () => {
    findUnique.mockResolvedValue({ handle: null, profile: null });
    const body = await (await get()).json();
    expect(body).toEqual({
      handle: null,
      displayName: null,
      avatarUrl: null,
      profileUrl: null,
      palette: { scheme: 'dark', tokens: expect.any(Object) },
      links: []
    });
    expect(body.palette.tokens['--bg']).toBe(profilePalette(null, null).tokens['--bg']);
  });

  it.each([{}, { authorization: 'Bearer nope' }, { authorization: `Token ${KEY}` }])(
    'refuses %j with 401 and reads nothing',
    async (headers) => {
      const res = await get({ ...headers, origin: EXT });
      expect(res.status).toBe(401);
      expect(res.headers.get('access-control-allow-origin')).toBe(EXT);
      expect(await res.json()).toMatchObject({ error: expect.any(String), code: 'invalid_key' });
      expect(authenticateApiKey).not.toHaveBeenCalled();
      expect(findUnique).not.toHaveBeenCalled();
    }
  );

  it('refuses an unknown or revoked key with 401', async () => {
    authenticateApiKey.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('limits each key with the API key rate, apart from shortening', async () => {
    rateLimit.mockResolvedValue({ allowed: false });
    const res = await get();
    expect(res.status).toBe(429);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(rateLimit).toHaveBeenCalledWith('apikey:7:profile', API_KEY_RATE.requests, API_KEY_RATE.windowMs);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('OPTIONS /api/me/profile', () => {
  it('lets an extension send GET with its key', async () => {
    const res = await OPTIONS({
      request: new Request('https://www.iksi.app/api/me/profile', { method: 'OPTIONS', headers: { origin: EXT } })
    } as never);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(EXT);
    expect(res.headers.get('access-control-allow-methods')).toBe('GET');
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
    expect(res.headers.get('allow')).toBe('GET, OPTIONS');
  });

  it('grants nothing to a web page', async () => {
    const res = await OPTIONS({
      request: new Request('https://www.iksi.app/api/me/profile', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example' }
      })
    } as never);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
