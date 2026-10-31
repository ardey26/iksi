import { describe, it, expect, vi } from 'vitest';
import { normalizeAvatarUrl, verifyAvatarUrl } from './avatar-url';

describe('normalizeAvatarUrl', () => {
  it('rewrites Google Drive share URLs to the direct-view form', () => {
    expect(normalizeAvatarUrl('https://drive.google.com/file/d/ABC123_-/view'))
      .toBe('https://drive.google.com/uc?export=view&id=ABC123_-');
    expect(normalizeAvatarUrl('https://drive.google.com/file/d/ABC123/view?usp=sharing'))
      .toBe('https://drive.google.com/uc?export=view&id=ABC123');
  });

  it('bumps low-res Google OAuth avatars to 400px', () => {
    expect(normalizeAvatarUrl('https://lh3.googleusercontent.com/a/AGN...=s96-c'))
      .toBe('https://lh3.googleusercontent.com/a/AGN...=s400-c');
    expect(normalizeAvatarUrl('https://lh3.googleusercontent.com/a/x=s48'))
      .toBe('https://lh3.googleusercontent.com/a/x=s400');
  });

  it('bumps low-res Twitter profile images to 400x400', () => {
    expect(normalizeAvatarUrl('https://pbs.twimg.com/profile_images/123/abc_normal.jpg'))
      .toBe('https://pbs.twimg.com/profile_images/123/abc_400x400.jpg');
    expect(normalizeAvatarUrl('https://pbs.twimg.com/profile_images/123/abc_bigger.png'))
      .toBe('https://pbs.twimg.com/profile_images/123/abc_400x400.png');
  });

  it('leaves non-provider URLs alone', () => {
    expect(normalizeAvatarUrl('  https://cdn.example.com/me.png  '))
      .toBe('https://cdn.example.com/me.png');
  });
});

function mockRes(ok: boolean, status: number, contentType: string | null) {
  return {
    ok,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) }
  } as unknown as Response;
}

describe('verifyAvatarUrl', () => {
  it('accepts an image content-type via HEAD', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockRes(true, 200, 'image/png'));
    const result = await verifyAvatarUrl('https://cdn.example.com/x.png', fetchImpl as any);
    expect(result.ok).toBe(true);
  });

  it('rejects a text/html response (e.g. Google Drive share page)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockRes(true, 200, 'text/html; charset=utf-8'));
    const result = await verifyAvatarUrl('https://drive.google.com/uc?export=view&id=abc', fetchImpl as any);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/doesn't return an image/);
  });

  it('rejects non-https URLs', async () => {
    const result = await verifyAvatarUrl('http://example.com/x.png');
    expect(result.ok).toBe(false);
  });

  it('falls back to ranged GET when HEAD fails', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(mockRes(false, 405, null))
      .mockResolvedValueOnce(mockRes(true, 206, 'image/jpeg'));
    const result = await verifyAvatarUrl('https://cdn.example.com/x.jpg', fetchImpl as any);
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('surfaces network errors as a friendly message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await verifyAvatarUrl('https://cdn.example.com/x.png', fetchImpl as any);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Could not reach/);
  });
});
