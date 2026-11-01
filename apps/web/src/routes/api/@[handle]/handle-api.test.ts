import { describe, it, expect, vi, beforeEach } from 'vitest';

const handleFindUnique = vi.hoisted(() => vi.fn());
vi.mock('#lib/prisma.js', () => ({
  prisma: {
    handle: { findUnique: handleFindUnique },
    rateLimit: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) }
  }
}));

import { GET } from './+server';

const call = () =>
  GET({
    params: { handle: 'ann' },
    request: new Request('https://www.iksi.app/api/@ann'),
    getClientAddress: () => '1.2.3.4'
  } as never);

const row = (title: string, shortURL: string, oneTime = false) => ({
  title,
  link: { shortURL, clickCount: 3, oneTime }
});

beforeEach(() => {
  vi.clearAllMocks();
  handleFindUnique.mockResolvedValue({
    user: {
      profile: {
        displayName: 'Ann',
        bio: null,
        avatarUrl: null,
        theme: 'default',
        accent: '#3B82F6',
        publicClicks: false,
        rows: [row('GitHub', 'gh1'), row('Secret', 'Sec1234567', true)]
      }
    }
  });
});

describe('GET /api/@handle', () => {
  it('asks the database for rows whose link is not one-time', async () => {
    await call();
    const rows = handleFindUnique.mock.calls[0][0].include.user.include.profile.include.rows;
    expect(rows.where).toMatchObject({ link: { is: { oneTime: false } } });
  });

  it('never lists a one-time link', async () => {
    const body = await (await call()).json();
    expect(body.rows).toEqual([{ title: 'GitHub', url: 'https://iksi.app/gh1' }]);
    expect(JSON.stringify(body)).not.toContain('Sec1234567');
  });
});
