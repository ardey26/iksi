// The editor's preview lists the same rows the public page does, in order.
import { describe, it, expect, vi } from 'vitest';
import { PUBLIC_ROW_WHERE } from '#lib/server/profile-rows.js';

const findUnique = vi.hoisted(() => vi.fn());
vi.mock('#lib/prisma.js', () => ({
  prisma: {
    profile: { findUnique },
    user: { findUnique: vi.fn(async () => ({ scopeCustomNames: false })) }
  }
}));

import { load } from './+page.server';

const profile = (rows: unknown[]) => ({
  displayName: 'Ana',
  bio: null,
  avatarUrl: null,
  backgroundUrl: null,
  theme: '20',
  accent: '#3B82F6',
  publicClicks: false,
  payMethods: [],
  payLabel: 'pay',
  rows
});
const run = () => load({ parent: async () => ({ user: { id: 1 } }) } as never) as Promise<any>;

describe('profile editor loader rows', () => {
  it('reads the public rows in page order', async () => {
    findUnique.mockResolvedValueOnce(profile([]));
    await run();
    const { rows } = findUnique.mock.calls[0][0].select;
    expect(rows.where).toEqual(PUBLIC_ROW_WHERE);
    expect(rows.orderBy).toEqual({ position: 'asc' });
  });

  it('returns their titles, leaving out what the public page leaves out', async () => {
    findUnique.mockResolvedValueOnce(
      profile([
        { id: 3, title: 'Pre-order', link: { oneTime: false } },
        { id: 4, title: 'Secret', link: { oneTime: true } },
        { id: 5, title: 'Menu', link: null }
      ])
    );
    const out = await run();
    expect(out.rows).toEqual([
      { id: 3, title: 'Pre-order' },
      { id: 5, title: 'Menu' }
    ]);
    expect(out.profile).not.toHaveProperty('rows');
  });

  it('returns no rows when there are none', async () => {
    findUnique.mockResolvedValueOnce(profile([]));
    expect((await run()).rows).toEqual([]);
  });
});
