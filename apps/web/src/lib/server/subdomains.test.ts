import { describe, it, expect, afterEach, vi } from 'vitest';
import { subdomainDecision, subdomainsEnabled } from './subdomains';

type Input = Parameters<typeof subdomainDecision>[0];

const req = (over: Partial<Input>): Input => ({
  host: 'www.iksi.app',
  pathname: '/',
  search: '',
  method: 'GET',
  routeId: '/',
  handle: undefined,
  enabled: true,
  ...over
});

const PASS = { kind: 'pass' };
const DAILY = 'public, max-age=86400';

afterEach(() => vi.unstubAllEnvs());

describe('subdomainsEnabled', () => {
  it('is on only for the exact string true', () => {
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    expect(subdomainsEnabled()).toBe(true);
    for (const v of ['', 'TRUE', '1', 'yes', 'false']) {
      vi.stubEnv('SUBDOMAINS_ENABLED', v);
      expect(subdomainsEnabled()).toBe(false);
    }
  });
});

describe('on a profile subdomain', () => {
  const sub = (over: Partial<Input>) => req({ host: 'andre.iksi.app', ...over });

  it('sends a subdomain back to www/@handle while subdomains are off, never cached', () => {
    const back = (location: string) => ({ kind: 'redirect', status: 302, location, cacheControl: 'no-store' });
    expect(subdomainDecision(sub({ enabled: false, routeId: '/@[handle]', handle: 'andre' }))).toEqual(
      back('https://www.iksi.app/@andre')
    );
    expect(subdomainDecision(sub({ enabled: false, pathname: '/sale', search: '?s=x', routeId: '/@[handle]/[name]', handle: 'andre' }))).toEqual(
      back('https://www.iksi.app/@andre/sale?s=x')
    );
    expect(subdomainDecision(sub({ enabled: false, pathname: '/sale+', routeId: '/@[handle]/[name]', handle: 'andre' }))).toEqual(
      back('https://www.iksi.app/@andre/sale+')
    );
    expect(subdomainDecision(sub({ enabled: false, pathname: '/dashboard', routeId: '/(app)/dashboard' }))).toEqual(
      back('https://www.iksi.app/dashboard')
    );
    expect(subdomainDecision(sub({ enabled: false, pathname: '/a/b', routeId: null }))).toEqual(back('https://www.iksi.app/a/b'));
  });

  it('leaves reserved and invalid hosts alone while off', () => {
    for (const host of ['admin.iksi.app', 'cdn.iksi.app', 'my_handle.iksi.app', 'xn--abc.iksi.app', 'a.b.iksi.app']) {
      expect(subdomainDecision(req({ host, enabled: false, pathname: '/x', routeId: '/[slug]' }))).toEqual(PASS);
    }
  });

  it('serves the owner profile, its links, its API and media when on', () => {
    expect(subdomainDecision(sub({ routeId: '/@[handle]', handle: 'andre' }))).toEqual(PASS);
    expect(subdomainDecision(sub({ pathname: '/sale+', routeId: '/@[handle]/[name]', handle: 'andre' }))).toEqual(PASS);
    expect(subdomainDecision(sub({ pathname: '/api/@andre/pay', routeId: '/api/@[handle]/pay' }))).toEqual(PASS);
    expect(subdomainDecision(sub({ pathname: '/media/7/avatar/a.webp', routeId: '/media/[uid]/[kind]/[file]' }))).toEqual(PASS);
    expect(subdomainDecision(sub({ pathname: '/robots.txt', routeId: '/robots.txt' }))).toEqual(PASS);
  });

  it('sends app pages and other profiles to www', () => {
    expect(subdomainDecision(sub({ pathname: '/dashboard', search: '?x=1', routeId: '/(app)/dashboard' }))).toEqual({
      kind: 'redirect',
      status: 302,
      location: 'https://www.iksi.app/dashboard?x=1'
    });
    expect(subdomainDecision(sub({ pathname: '/@bob', routeId: '/@[handle]', handle: 'bob' }))).toEqual({
      kind: 'redirect',
      status: 302,
      location: 'https://www.iksi.app/@bob'
    });
  });

  it('lets an unmatched path 404 normally', () => {
    expect(subdomainDecision(sub({ pathname: '/a/b', routeId: null }))).toEqual(PASS);
  });
});

describe('www profile redirect', () => {
  it('301s www/@handle to the subdomain root, rechecked daily', () => {
    expect(subdomainDecision(req({ pathname: '/@andre', routeId: '/@[handle]', handle: 'andre' }))).toEqual({
      kind: 'redirect',
      status: 301,
      location: 'https://andre.iksi.app/',
      cacheControl: DAILY
    });
  });

  it('301s www/@handle/name (and name+) to the subdomain path, keeping the query', () => {
    expect(
      subdomainDecision(req({ pathname: '/@Andre/Sale+', search: '?s=profile', routeId: '/@[handle]/[name]', handle: 'Andre' }))
    ).toEqual({ kind: 'redirect', status: 301, location: 'https://andre.iksi.app/Sale+?s=profile', cacheControl: DAILY });
  });

  it('never redirects while off', () => {
    expect(subdomainDecision(req({ enabled: false, pathname: '/@andre', routeId: '/@[handle]', handle: 'andre' }))).toEqual(PASS);
  });

  it('never redirects a handle without a subdomain', () => {
    for (const handle of ['my_handle', 'www', 'admin', 'ab--c']) {
      expect(subdomainDecision(req({ pathname: `/@${handle}`, routeId: '/@[handle]', handle }))).toEqual(PASS);
    }
  });

  it('never redirects on the apex, admin, previews or localhost', () => {
    for (const host of ['iksi.app', 'admin.iksi.app', 'iksi-abc.vercel.app', 'localhost:5174']) {
      expect(subdomainDecision(req({ host, pathname: '/@andre', routeId: '/@[handle]', handle: 'andre' }))).toEqual(PASS);
    }
  });

  it('never touches short links or other pages', () => {
    expect(subdomainDecision(req({ pathname: '/abc', routeId: '/[slug]' }))).toEqual(PASS);
    expect(subdomainDecision(req({ host: 'iksi.app', pathname: '/@andre/sale', routeId: '/@[handle]/[name]', handle: 'andre' }))).toEqual(PASS);
    expect(subdomainDecision(req({ pathname: '/api/@andre', routeId: '/api/@[handle]' }))).toEqual(PASS);
  });

  it('only redirects reads', () => {
    expect(subdomainDecision(req({ method: 'POST', pathname: '/@andre/sale', routeId: '/@[handle]/[name]', handle: 'andre' }))).toEqual(PASS);
    expect(subdomainDecision(req({ method: 'HEAD', pathname: '/@andre', routeId: '/@[handle]', handle: 'andre' })).kind).toBe('redirect');
  });
});
