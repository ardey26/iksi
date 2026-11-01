import { describe, it, expect } from 'vitest';
import {
  RESERVED_HANDLES,
  hasSubdomain,
  profileLabel,
  profileUrl,
  routedPathname,
  subdomainHandleOf,
  subdomainReroute,
  handleSubdomainReport,
  appHref,
  profileHref
} from './subdomains';

const at = (host: string, path: string) => new URL(`https://${host}${path}`);

describe('subdomainReroute', () => {
  it.each([
    ['andre.iksi.app', '/', '/@andre'],
    ['andre.iksi.app', '/sale', '/@andre/sale'],
    ['andre.iksi.app', '/sale+', '/@andre/sale+'],
    ['andre.iksi.app', '/Sale_2-x', '/@andre/Sale_2-x'],
    ['andre.iksi.app', '/media', '/@andre/media'],
    ['ANDRE.IKSI.APP', '/', '/@andre'],
    ['Andre.iksi.app:443', '/sale', '/@andre/sale'],
    ['andre.iksi.app.', '/', '/@andre']
  ])('%s%s -> %s', (host, path, to) => expect(subdomainReroute(at(host, path))).toBe(to));

  it.each([
    '/_app/immutable/entry/start.js',
    '/fonts/geist.woff2',
    '/media/7/avatar/a.256.webp',
    '/favicon.svg',
    '/favicon.png',
    '/robots.txt',
    '/sitemap.xml',
    '/manifest.json',
    '/og-image.png',
    '/icon-512.png',
    '/api/@andre/pay',
    '/@andre',
    '/@andre/sale',
    '/dashboard',
    '/login',
    '/sale/',
    '/a/b',
    '/sale%20x'
  ])('leaves %s on a subdomain alone', (path) => expect(subdomainReroute(at('andre.iksi.app', path))).toBeUndefined());

  it.each([
    'www.iksi.app',
    'admin.iksi.app',
    'cdn.iksi.app',
    'api.iksi.app',
    'iksi.app',
    'a.b.iksi.app',
    'xn--andr-epa.iksi.app',
    'ab--cd.iksi.app',
    'my_handle.iksi.app',
    '-andre.iksi.app',
    'andre-.iksi.app',
    'ab.iksi.app',
    'andre.iksi.app.evil.com',
    'andreiksi.app',
    'andre.vercel.app',
    'localhost',
    'localhost:5174'
  ])('leaves host %s alone', (host) => {
    expect(subdomainReroute(at(host, '/'))).toBeUndefined();
    expect(subdomainReroute(at(host, '/sale'))).toBeUndefined();
  });

  it('maps <handle>.localhost only in dev', () => {
    expect(subdomainReroute(at('andre.localhost:5174', '/sale'), true)).toBe('/@andre/sale');
    expect(subdomainReroute(at('andre.localhost:5174', '/sale'), false)).toBeUndefined();
    expect(subdomainReroute(at('admin.localhost:5174', '/'), true)).toBeUndefined();
  });
});

describe('subdomainHandleOf', () => {
  it('reads the handle from a subdomain host', () => {
    expect(subdomainHandleOf('andre.iksi.app')).toBe('andre');
    expect(subdomainHandleOf('a-b9.iksi.app')).toBe('a-b9');
  });
  it('is null for reserved, apex and foreign hosts', () => {
    for (const h of ['www.iksi.app', 'admin.iksi.app', 'iksi.app', 'example.com', '']) {
      expect(subdomainHandleOf(h)).toBeNull();
    }
  });
});

describe('routedPathname', () => {
  it('is the rerouted path on a subdomain and the plain path elsewhere', () => {
    expect(routedPathname(at('andre.iksi.app', '/sale+'))).toBe('/@andre/sale+');
    expect(routedPathname(at('andre.iksi.app', '/@andre/sale'))).toBe('/@andre/sale');
    expect(routedPathname(at('www.iksi.app', '/sale'))).toBe('/sale');
  });
});

describe('reserved handles', () => {
  it.each([
    'www', 'admin', 'api', 'cdn', 'app', 'mail', 'email', 'smtp', 'imap', 'pop', 'ftp', 'ns1', 'ns2',
    'status', 'blog', 'docs', 'help', 'support', 'static', 'assets', 'media', 'dev', 'staging', 'test',
    'beta', 'auth', 'login', 'dashboard'
  ])('%s is reserved and has no subdomain', (h) => {
    expect(RESERVED_HANDLES).toContain(h);
    expect(hasSubdomain(h)).toBe(false);
  });

  it('is lowercase and unique', () => {
    expect(new Set(RESERVED_HANDLES).size).toBe(RESERVED_HANDLES.length);
    for (const h of RESERVED_HANDLES) expect(h).toBe(h.toLowerCase());
  });
});

describe('hasSubdomain', () => {
  it.each(['andre', 'a-b', 'abc', '9lives', 'a'.repeat(30)])('%s can be a subdomain', (h) =>
    expect(hasSubdomain(h)).toBe(true)
  );
  it.each(['my_handle', '-ab', 'ab-', 'xn--abc', 'ab--c', 'ab', 'a'.repeat(31), 'Andre', 'www'])(
    '%s cannot',
    (h) => expect(hasSubdomain(h)).toBe(false)
  );
});

describe('profileUrl / profileLabel', () => {
  it('uses the subdomain when enabled', () => {
    expect(profileUrl('andre', true)).toBe('https://andre.iksi.app/');
    expect(profileLabel('andre', true)).toBe('andre.iksi.app');
  });
  it('uses www/@handle when disabled', () => {
    expect(profileUrl('andre', false)).toBe('https://www.iksi.app/@andre');
    expect(profileLabel('andre', false)).toBe('iksi.app/@andre');
  });
  it('keeps www/@handle for a handle that cannot be a hostname', () => {
    expect(profileUrl('my_handle', true)).toBe('https://www.iksi.app/@my_handle');
    expect(profileLabel('my_handle', true)).toBe('iksi.app/@my_handle');
  });
});

describe('handleSubdomainReport', () => {
  it('reports reserved collisions and handles without a subdomain, changing nothing', () => {
    const handles = ['andre', 'blog', 'my_handle', 'staging', '-dash', 'ok-1'];
    const copy = [...handles];
    expect(handleSubdomainReport(handles)).toEqual({ reserved: ['blog', 'staging'], noSubdomain: ['my_handle', '-dash'] });
    expect(handles).toEqual(copy);
  });
});

describe('appHref', () => {
  it('points app links at www from a subdomain, where the session cookie lives', () => {
    expect(appHref('/login', 'andre.iksi.app')).toBe('https://www.iksi.app/login');
    expect(appHref('/', 'andre.iksi.app')).toBe('https://www.iksi.app/');
  });
  it('stays relative everywhere else', () => {
    expect(appHref('/login', 'www.iksi.app')).toBe('/login');
    expect(appHref('/dashboard', 'admin.iksi.app')).toBe('/dashboard');
    expect(appHref('/', 'localhost:5174')).toBe('/');
  });
});

describe('profileHref', () => {
  it('links the subdomain when on, and the www path otherwise', () => {
    expect(profileHref('andre', true)).toBe('https://andre.iksi.app/');
    expect(profileHref('andre', false)).toBe('/@andre');
    expect(profileHref('my_handle', true)).toBe('/@my_handle');
  });
});
