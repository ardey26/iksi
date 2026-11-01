import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const findFirst = vi.hoisted(() => vi.fn());
vi.mock('#lib/prisma.js', () => ({ prisma: { profile: { findFirst } } }));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL: vi.fn(async (u: string) => u) }));
vi.mock('#lib/server/tracking.js', () => ({ recordProfileView: vi.fn(async () => {}) }));
const tagProfile = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('#lib/server/profile-cache.js', () => ({ tagProfile }));

import { load } from './+page.server';

const link = (id: number, originalURL: string, passwordHash: string | null = null) => ({
  id,
  shortURL: `s${id}`,
  originalURL,
  clickCount: 0,
  passwordHash
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
