import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const findFirst = vi.hoisted(() => vi.fn());
vi.mock('#lib/prisma.js', () => ({ prisma: { profile: { findFirst } } }));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL: vi.fn(async (u: string) => u) }));
vi.mock('#lib/server/tracking.js', () => ({ recordProfileView: vi.fn(async () => {}) }));
const tagProfile = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('#lib/server/profile-cache.js', () => ({ tagProfile }));

import { load } from './+page.server';
import { payQrPayload } from '../../test/pay-qr';

const link = (id: number, originalURL: string, passwordHash: string | null = null, oneTime = false) => ({
  id,
  shortURL: `s${id}`,
  originalURL,
  clickCount: 0,
  passwordHash,
  oneTime
});

function profile(rows: { id: number; title: string; link: ReturnType<typeof link> }[]) {
  return {
    id: 1,
    userId: 42,
    displayName: 'A',
    bio: null,
    avatarUrl: null,
    theme: 'default',
    accent: null,
    publicClicks: false,
    rows
  };
}

const run = () =>
  load({
    params: { handle: 'ann' },
    request: new Request('https://www.iksi.app/@ann'),
    setHeaders: () => {}
  } as never) as Promise<{ sameAs: string[]; rows: unknown[] }>;

beforeEach(() => vi.clearAllMocks());

describe('profile page cache tag', () => {
  it('tags the cached page with its owner so updates can clear it', async () => {
    findFirst.mockResolvedValue(profile([]));
    await run();
    expect(tagProfile).toHaveBeenCalledWith(42);
  });
});

describe('profile JSON-LD sameAs', () => {
  it('lists a public social destination', async () => {
    findFirst.mockResolvedValue(profile([{ id: 1, title: 'GitHub', link: link(1, 'https://github.com/ann') }]));
    expect((await run()).sameAs).toEqual(['https://github.com/ann']);
  });

  it('leaves out a password-protected link, which still shows as a row', async () => {
    findFirst.mockResolvedValue(
      profile([
        { id: 1, title: 'GitHub', link: link(1, 'https://github.com/ann') },
        { id: 2, title: 'Private', link: link(2, 'https://x.com/ann-private', '$2b$10$hash') }
      ])
    );
    const data = await run();
    expect(data.sameAs).toEqual(['https://github.com/ann']);
    expect(JSON.stringify(data)).not.toContain('ann-private');
    expect(data.rows).toHaveLength(2);
    expect(JSON.stringify(data)).not.toContain('$2b$10$hash');
  });

  it('selects the password hash so protection can be seen', async () => {
    findFirst.mockResolvedValue(profile([]));
    await run();
    expect(findFirst.mock.calls[0][0].select.rows.select.link.select).toMatchObject({ passwordHash: true });
  });
});

describe('one-time links on a profile', () => {
  it('never shows a one-time link, even if a row points at one', async () => {
    findFirst.mockResolvedValue(
      profile([
        { id: 1, title: 'GitHub', link: link(1, 'https://github.com/ann') },
        { id: 2, title: 'Secret', link: link(2, '', null, true) }
      ])
    );
    const data = await run();
    expect(data.rows).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain('Secret');
    expect(JSON.stringify(data)).not.toContain('s2');
  });

  it('selects the one-time mark', async () => {
    findFirst.mockResolvedValue(profile([]));
    await run();
    expect(findFirst.mock.calls[0][0].select.rows.select.link.select).toMatchObject({ oneTime: true });
  });
});

describe('profile media urls', () => {
  const saved = process.env.MEDIA_BASE_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.MEDIA_BASE_URL;
    else process.env.MEDIA_BASE_URL = saved;
  });

  it('serves stored cdn.iksi.app avatar and background from MEDIA_BASE_URL', async () => {
    process.env.MEDIA_BASE_URL = 'https://www.iksi.app/media';
    findFirst.mockResolvedValue({
      ...profile([]),
      avatarUrl: 'https://cdn.iksi.app/7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp',
      backgroundUrl: 'https://cdn.iksi.app/7/background/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.1600.webp'
    });
    const out = (await run()) as unknown as { avatarUrl: string; backgroundUrl: string };
    expect(out.avatarUrl).toBe('https://www.iksi.app/media/7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp');
    expect(out.backgroundUrl).toBe(
      'https://www.iksi.app/media/7/background/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.1600.webp'
    );
  });
});

describe('profile payment methods', () => {
  const kofi = { id: 'l1', kind: 'link', provider: 'kofi', url: 'https://ko-fi.com/ann' };

  it('returns no Pay button without methods', async () => {
    findFirst.mockResolvedValue(profile([]));
    expect(((await run()) as any).pay).toBeNull();
  });

  it('returns the methods and label for the Pay button', async () => {
    const payload = payQrPayload();
    findFirst.mockResolvedValue({
      ...profile([]),
      payLabel: 'tip',
      payMethods: [{ id: 'q1', kind: 'qr', payload }, kofi]
    });
    expect(((await run()) as any).pay).toEqual({
      label: 'tip',
      methods: [
        {
          id: 'q1',
          kind: 'qr',
          institution: 'gcash',
          label: 'GCash',
          name: 'JUAN DELA CRUZ',
          city: 'MANDALUYONG',
          country: 'PH',
          currency: 'PHP'
        },
        kofi
      ]
    });
  });

  it('names a QR stored with a wallet provider by its bank', async () => {
    findFirst.mockResolvedValue({ ...profile([]), payMethods: [{ id: 'q1', kind: 'qr', payload: payQrPayload({ bic: 'LAUIPHM2XXX' }), provider: 'gcash' }] });
    const [m] = ((await run()) as any).pay.methods;
    expect(m).toMatchObject({ institution: 'maribank', label: 'MariBank' });
    expect(m).not.toHaveProperty('provider');
    expect(m).not.toHaveProperty('bic');
  });

  it('keeps the QR payload, which can hold a mobile number, out of the cached page', async () => {
    const payload = payQrPayload();
    findFirst.mockResolvedValue({ ...profile([]), payMethods: [{ id: 'q1', kind: 'qr', payload, provider: 'gcash' }] });
    const text = JSON.stringify(await run());
    expect(text).not.toContain(payload);
    expect(text).not.toContain('09171234567');
    expect(text).not.toContain('payload');
  });

  it('never shows a stored link that fails the allow-list', async () => {
    findFirst.mockResolvedValue({
      ...profile([]),
      payMethods: [{ id: 'l9', kind: 'link', provider: 'paypal', url: 'https://paypal.me.evil.com/x' }]
    });
    expect(((await run()) as any).pay).toBeNull();
  });

  it('selects the payment columns', async () => {
    findFirst.mockResolvedValue(profile([]));
    await run();
    expect(findFirst.mock.calls[0][0].select).toMatchObject({ payMethods: true, payLabel: true });
  });
});

describe('profile on its subdomain', () => {
  afterEach(() => vi.unstubAllEnvs());

  const scoped = (id: number, name: string) => ({ ...link(id, 'https://example.com'), shortURL: `@ann/${name}` });
  const rows = () =>
    profile([
      { id: 1, title: 'Global', link: link(1, 'https://example.com') },
      { id: 2, title: 'Scoped', link: scoped(2, 'sale') }
    ]);

  const at = (href: string, setHeaders: (h: Record<string, string>) => void = () => {}) =>
    load({
      params: { handle: 'ann' },
      url: new URL(href),
      request: new Request(href),
      setHeaders
    } as never) as Promise<{ rows: { href: string }[]; subdomains: boolean }>;

  it('is cached and tagged by owner like on www, so a purge clears this copy too', async () => {
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    findFirst.mockResolvedValue(rows());
    const headers: Record<string, string> = {};
    await at('https://ann.iksi.app/', (h) => Object.assign(headers, h));
    expect(tagProfile).toHaveBeenCalledWith(42);
    expect(headers['cache-control']).toBe('public, s-maxage=60, stale-while-revalidate=600');
  });

  it('links its own names by path and global links to iksi.app, which the subdomain would misread', async () => {
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    findFirst.mockResolvedValue(rows());
    const data = await at('https://ann.iksi.app/');
    expect(data.rows.map((r) => r.href)).toEqual([
      'https://iksi.app/s1?s=profile&p=1&r=1',
      '/sale?s=profile&p=1&r=2'
    ]);
  });

  it('keeps relative links on www', async () => {
    findFirst.mockResolvedValue(rows());
    const data = await at('https://www.iksi.app/@ann');
    expect(data.rows.map((r) => r.href)).toEqual(['/s1?s=profile&p=1&r=1', '/@ann/sale?s=profile&p=1&r=2']);
  });

  it('tells the page whether subdomains are on', async () => {
    findFirst.mockResolvedValue(rows());
    expect((await at('https://www.iksi.app/@ann')).subdomains).toBe(false);
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    expect((await at('https://www.iksi.app/@ann')).subdomains).toBe(true);
  });

  it('renders www/@handle?via=sub like www/@handle: same cache header, same owner tag, same data', async () => {
    findFirst.mockResolvedValue(rows());
    const plain: Record<string, string> = {};
    const a = await at('https://www.iksi.app/@ann', (h) => Object.assign(plain, h));
    const via: Record<string, string> = {};
    const b = await at('https://www.iksi.app/@ann?via=sub', (h) => Object.assign(via, h));
    expect(via).toEqual(plain);
    expect(b).toEqual(a);
    expect(tagProfile.mock.calls).toEqual([[42], [42]]);
  });
});
