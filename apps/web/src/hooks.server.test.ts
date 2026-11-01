import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { findFirst: vi.fn(async () => null) } } }));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL: vi.fn() }));

import { handle } from './hooks.server';

function event(href: string, routeId: string | null, params: Record<string, string> = {}, isDataRequest = false) {
  const url = new URL(href);
  return {
    url,
    params,
    isDataRequest,
    route: { id: routeId },
    request: new Request(url, { headers: { host: url.host } })
  };
}

const resolve = vi.fn(async () => new Response('page', { status: 200 }));
const run = (e: ReturnType<typeof event>) => handle({ event: e, resolve } as never);

afterEach(() => {
  vi.unstubAllEnvs();
  resolve.mockClear();
});

describe('subdomain gate', () => {
  it('404s a subdomain request while SUBDOMAINS_ENABLED is unset', async () => {
    const res = await run(event('https://andre.iksi.app/', '/@[handle]', { handle: 'andre' }));
    expect(res.status).toBe(404);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('serves the profile on its subdomain when enabled', async () => {
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    const res = await run(event('https://andre.iksi.app/', '/@[handle]', { handle: 'andre' }));
    expect(res.status).toBe(200);
  });

  it('does not redirect www/@handle while disabled', async () => {
    const res = await run(event('https://www.iksi.app/@andre', '/@[handle]', { handle: 'andre' }));
    expect(res.status).toBe(200);
  });

  it('301s www/@handle to the subdomain with a daily cache-control when enabled', async () => {
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    const res = await run(event('https://www.iksi.app/@andre/sale', '/@[handle]/[name]', { handle: 'andre', name: 'sale' }));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://andre.iksi.app/sale');
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
    expect(resolve).not.toHaveBeenCalled();
  });

  it('answers a client-side data request with a redirect SvelteKit can follow', async () => {
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    await expect(run(event('https://www.iksi.app/@andre', '/@[handle]', { handle: 'andre' }, true))).rejects.toMatchObject({
      status: 301,
      location: 'https://andre.iksi.app/'
    });
  });

  it('keeps admin.iksi.app as it was', async () => {
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    const root = await run(event('https://admin.iksi.app/', '/'));
    expect(root.status).toBe(302);
    expect(root.headers.get('location')).toBe('/admin');
    expect((await run(event('https://admin.iksi.app/admin', '/(admin)/admin'))).status).toBe(200);
    expect((await run(event('https://www.iksi.app/admin', '/(admin)/admin'))).status).toBe(404);
  });
});
