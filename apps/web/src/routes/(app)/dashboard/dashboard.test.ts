import { describe, it, expect, vi } from 'vitest';

const listApiKeys = vi.hoisted(() => vi.fn());
vi.mock('#lib/server/api-keys.js', () => ({ listApiKeys }));
vi.mock('#lib/prisma.js', () => ({ prisma: { $queryRaw: vi.fn(async () => [{ views: 0, clicks: 0 }]) } }));

import { load } from './+page.server.js';

const KEYS = [{ id: 1, name: 'Laptop', prefix: 'iksi_ab12', createdAt: '2026-11-01T00:00:00.000Z', lastUsedAt: null }];

describe('dashboard load', () => {
  it("lists the user's API keys", async () => {
    listApiKeys.mockResolvedValue(KEYS);
    const user = { id: 42, handle: 'ana', profileId: 3 };
    const data = (await load({ parent: async () => ({ user }) } as never)) as { apiKeys: unknown };
    expect(listApiKeys).toHaveBeenCalledWith(42);
    expect(data.apiKeys).toEqual(KEYS);
  });
});
