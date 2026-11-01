import { describe, it, expect, vi, afterEach } from 'vitest';

const findMany = vi.hoisted(() => vi.fn());
vi.mock('#lib/prisma.js', () => ({ prisma: { profile: { findMany } } }));

const day = new Date('2026-10-01T00:00:00Z');
const profile = (handle) => ({ updatedAt: day, user: { handle: { handle } }, rows: [] });

// The route caches the sitemap in memory, so each case loads it fresh.
async function sitemap() {
  vi.resetModules();
  const { GET } = await import('./+server.js');
  return (await GET()).text();
}

afterEach(() => vi.unstubAllEnvs());

describe('sitemap profile URLs', () => {
  it('lists www/@handle while subdomains are off', async () => {
    findMany.mockResolvedValue([profile('ann')]);
    expect(await sitemap()).toContain('<loc>https://www.iksi.app/@ann</loc>');
  });

  it('lists only www/@handle when on, never a subdomain', async () => {
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    findMany.mockResolvedValue([profile('ann'), profile('a_b')]);
    const xml = await sitemap();
    expect(xml).toContain('<loc>https://www.iksi.app/@ann</loc>');
    expect(xml).toContain('<loc>https://www.iksi.app/@a_b</loc>');
    expect(xml).not.toContain('ann.iksi.app');
  });
});

describe('sitemap static pages', () => {
  it('lists the home page and the privacy policy, even when profiles fail to load', async () => {
    findMany.mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const xml = await sitemap();
    expect(xml).toContain('<loc>https://www.iksi.app/</loc>');
    expect(xml).toContain('<loc>https://www.iksi.app/privacy</loc>');
  });
});
