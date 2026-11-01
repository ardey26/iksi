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
  it('302s a subdomain request back to www/@handle, uncached, while SUBDOMAINS_ENABLED is unset', async () => {
    const res = await run(event('https://andre.iksi.app/sale+', '/@[handle]/[name]', { handle: 'andre', name: 'sale+' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://www.iksi.app/@andre/sale+?via=sub');
    expect(res.headers.get('cache-control')).toBe('no-store');
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

  // www/@handle is the canonical profile URL; the subdomain is a vanity alias.
  it('serves www/@handle and www/@handle/name without redirecting when enabled', async () => {
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    expect((await run(event('https://www.iksi.app/@andre', '/@[handle]', { handle: 'andre' }))).status).toBe(200);
    expect((await run(event('https://www.iksi.app/@andre/sale', '/@[handle]/[name]', { handle: 'andre', name: 'sale' }))).status).toBe(200);
    expect((await run(event('https://www.iksi.app/@andre', '/@[handle]', { handle: 'andre' }, true))).status).toBe(200);
    expect(resolve).toHaveBeenCalledTimes(3);
  });

  it('answers a client-side data request on a switched-off subdomain with a redirect SvelteKit can follow', async () => {
    await expect(run(event('https://andre.iksi.app/', '/@[handle]', { handle: 'andre' }, true))).rejects.toMatchObject({
      status: 302,
      location: 'https://www.iksi.app/@andre?via=sub'
    });
  });

  it.each([['true'], ['']])('serves www/@handle?via=sub without redirecting (SUBDOMAINS_ENABLED=%s)', async (flag) => {
    vi.stubEnv('SUBDOMAINS_ENABLED', flag);
    const res = await run(event('https://www.iksi.app/@andre?via=sub', '/@[handle]', { handle: 'andre' }));
    expect(res.status).toBe(200);
    expect(resolve).toHaveBeenCalledTimes(1);
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

describe('referrer policy', () => {
  it('defaults to strict-origin-when-cross-origin', async () => {
    const res = await run(event('https://www.iksi.app/', '/'));
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('keeps a stricter policy a route set (the extension connect page)', async () => {
    resolve.mockImplementationOnce(async () => new Response('page', { headers: { 'referrer-policy': 'no-referrer' } }));
    const res = await run(event('https://www.iksi.app/connect/extension', '/connect/extension'));
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });
});
