import { describe, it, expect, vi, beforeEach } from 'vitest';

const { addCacheTag, dangerouslyDeleteByTag } = vi.hoisted(() => ({
  addCacheTag: vi.fn(async () => {}),
  dangerouslyDeleteByTag: vi.fn(async () => {})
}));
vi.mock('@vercel/functions', () => ({ addCacheTag, dangerouslyDeleteByTag }));

const verifyUserSession = vi.hoisted(() => vi.fn());
vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession }));

import { profileCacheTag, tagProfile, purgeProfile, purgeProfileOnSuccess } from './profile-cache';

const event = () => ({ cookies: { get: () => 'session' } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  verifyUserSession.mockReturnValue(7);
});

describe('profile cache', () => {
  it('tags a profile page by its owner', async () => {
    await tagProfile(7);
    expect(addCacheTag).toHaveBeenCalledWith('profile-7');
    expect(profileCacheTag(7)).toBe('profile-7');
  });

  it('deletes the owner tag immediately', async () => {
    await purgeProfile(7);
    expect(dangerouslyDeleteByTag).toHaveBeenCalledWith('profile-7');
  });

  it('never throws when the purge fails', async () => {
    dangerouslyDeleteByTag.mockRejectedValueOnce(new Error('down'));
    await expect(purgeProfile(7)).resolves.toBeUndefined();
  });

  it('purges after a successful update', async () => {
    const handler = purgeProfileOnSuccess(async () => new Response(null, { status: 200 }));
    await handler(event());
    expect(dangerouslyDeleteByTag).toHaveBeenCalledWith('profile-7');
  });

  it('does not purge when the update fails', async () => {
    const handler = purgeProfileOnSuccess(async () => new Response(null, { status: 400 }));
    await handler(event());
    expect(dangerouslyDeleteByTag).not.toHaveBeenCalled();
  });

  it('does not purge for a signed-out request', async () => {
    verifyUserSession.mockReturnValue(null);
    const handler = purgeProfileOnSuccess(async () => new Response(null, { status: 204 }));
    await handler(event());
    expect(dangerouslyDeleteByTag).not.toHaveBeenCalled();
  });

  it('returns the original response', async () => {
    const res = new Response('x', { status: 201 });
    const handler = purgeProfileOnSuccess(async () => res);
    expect(await handler(event())).toBe(res);
  });
});
