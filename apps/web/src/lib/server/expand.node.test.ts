import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expandURL, isBlockedAddress } from './expand.js';

type Addr = { address: string; family: number };
const resolvesTo = (...addresses: string[]) =>
  vi.fn(async (_host: string): Promise<Addr[]> => addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })));

// One local server plays every remote site. Hosts like a.test resolve to it
// through the injected lookup, and only with the test-only loopback flag.
let server: http.Server;
let port = 0;
let hits: { method: string; path: string; headers: http.IncomingHttpHeaders }[] = [];
let getSocketClosed: Promise<void> = Promise.resolve();
const base = (host = 'a.test') => `http://${host}:${port}`;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits.push({ method: req.method!, path: req.url!, headers: req.headers });
    const url = new URL(req.url!, 'http://x');
    const [, kind, n] = url.pathname.split('/');
    if (kind === 'slow') {
      // Each hop answers just under the per-hop timeout, forever.
      setTimeout(() => res.writeHead(302, { location: `/slow/${Number(n) + 1}` }).end(), 250);
    } else if (kind === 'loop') {
      res.writeHead(302, { location: `/loop/${Number(n) + 1}` }).end();
    } else if (kind === 'metadata') {
      res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }).end();
    } else if (kind === 'private') {
      res.writeHead(301, { location: `http://intranet.test:${port}/` }).end();
    } else if (kind === 'ftp') {
      res.writeHead(302, { location: 'ftp://example.com/file' }).end();
    } else if (kind === 'userinfo') {
      res.writeHead(302, { location: `http://user:pass@b.test:${port}/ok` }).end();
    } else if (kind === 'hop1') {
      res.writeHead(302, { location: `${base('b.test')}/hop2` }).end();
    } else if (kind === 'hop2') {
      res.writeHead(307, { location: `${base('c.test')}/hop3` }).end();
    } else if (kind === 'hop3' || kind === 'ok') {
      res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'sid=1' }).end('<html></html>');
    } else if (kind === 'dir') {
      // /dir/sub/start sends a relative Location: resolve against this hop.
      if (url.pathname === '/dir/sub/start') res.writeHead(301, { location: '../next?x=1' }).end();
      else res.writeHead(200).end();
    } else if (kind === 'nohead') {
      if (req.method === 'HEAD') res.writeHead(405).end();
      else {
        // A body that never ends: reading it would hang the expander.
        getSocketClosed = new Promise((r) => req.socket.once('close', () => r()));
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.write('x'.repeat(1024));
      }
    } else if (kind === 'hang') {
      // Never answers.
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});
beforeEach(() => {
  hits = [];
});

const local = { lookup: resolvesTo('127.0.0.1'), allowLoopbackForTest: true };

describe('expandURL input checks', () => {
  it.each(['ftp://x', 'javascript:alert(1)', 'http://user:pass@x.com', 'http://user@x.com/', 'data:text/html,hi', '', 'http://', 'a'.repeat(3000)])(
    'refuses %s as bad-url without a request',
    async (input) => {
      const lookup = resolvesTo('93.184.216.34');
      const r = await expandURL(input, { lookup });
      expect(r).toEqual({ hops: [], final: null, stopped: 'bad-url' });
      expect(lookup).not.toHaveBeenCalled();
    }
  );

  it.each([':8080', ':22', ':6379', ':3000'])('refuses port %s as bad-url without a request', async (p) => {
    const lookup = resolvesTo('93.184.216.34');
    const r = await expandURL(`http://example.com${p}/`, { lookup });
    expect(r.stopped).toBe('bad-url');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('refuses a non-default port even when it reaches a live server', async () => {
    const lookup = resolvesTo('127.0.0.1');
    const r = await expandURL(`${base()}/ok`, { lookup });
    expect(r.stopped).toBe('bad-url');
    expect(lookup).not.toHaveBeenCalled();
    expect(hits).toHaveLength(0);
  });

  it('adds https:// to a bare host', async () => {
    const lookup = resolvesTo('10.0.0.1');
    const r = await expandURL('bit.ly/abc', { lookup });
    expect(lookup).toHaveBeenCalledWith('bit.ly');
    expect(r.stopped).toBe('blocked');
  });
});

describe('expandURL address checks', () => {
  it.each([
    '127.0.0.1',
    '127.255.0.9',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '0.0.0.0',
    '100.64.0.1',
    '192.0.0.8',
    '198.18.0.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'fec0::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:10.0.0.1',
    '64:ff9b::a9fe:a9fe',
    'fe80::1%en0'
  ])('blocks a host resolving to %s', async (address) => {
    const r = await expandURL('http://evil.test/', { lookup: resolvesTo(address) });
    expect(r).toEqual({ hops: [], final: null, stopped: 'blocked' });
  });

  it('blocks when any one of several resolved addresses is private', async () => {
    const r = await expandURL('http://evil.test/', { lookup: resolvesTo('93.184.216.34', '10.0.0.1') });
    expect(r.stopped).toBe('blocked');
  });

  it('blocks a host that resolves to nothing usable', async () => {
    const r = await expandURL('http://evil.test/', { lookup: resolvesTo('not-an-ip') });
    expect(r.stopped).toBe('blocked');
  });

  // Node skips the lookup for IP literals, so these must be checked first.
  it.each([
    'http://127.0.0.1/',
    'http://2130706433/',
    'http://0x7f.1/',
    'http://0177.0.0.1/',
    'http://127.1/',
    'http://127.0.0.1./',
    'http://0/',
    'http://10.1.2.3/',
    'http://169.254.169.254/latest/meta-data/',
    'https://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
    'http://[fe80::1]/',
    'http://[fc00::1]/'
  ])('blocks the IP literal %s without a lookup', async (input) => {
    const lookup = resolvesTo('93.184.216.34');
    const r = await expandURL(input, { lookup });
    expect(r).toEqual({ hops: [], final: null, stopped: 'blocked' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('allows public addresses', () => {
    for (const a of ['93.184.216.34', '8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '172.32.0.1', '100.128.0.1'])
      expect(isBlockedAddress(a), a).toBe(false);
  });

  it('lets the test flag through for loopback only', () => {
    expect(isBlockedAddress('127.0.0.1', true)).toBe(false);
    expect(isBlockedAddress('::1', true)).toBe(false);
    for (const a of ['10.0.0.1', '169.254.169.254', '192.168.0.1', 'fc00::1', '0.0.0.0'])
      expect(isBlockedAddress(a, true), a).toBe(true);
  });
});

describe('expandURL against a live server', () => {
  it('blocks a redirect to the metadata address after recording the public hop', async () => {
    const r = await expandURL(`${base()}/metadata`, local);
    expect(r.hops).toEqual([{ url: `${base()}/metadata`, status: 302 }]);
    expect(r).toMatchObject({ final: null, stopped: 'blocked' });
    expect(hits).toHaveLength(1);
  });

  it('re-checks the address of every hop', async () => {
    const lookup = vi.fn(async (host: string): Promise<Addr[]> =>
      host === 'intranet.test' ? [{ address: '10.0.0.7', family: 4 }] : [{ address: '127.0.0.1', family: 4 }]
    );
    const r = await expandURL(`${base()}/private`, { lookup, allowLoopbackForTest: true });
    expect(r.hops).toHaveLength(1);
    expect(r.stopped).toBe('blocked');
    expect(lookup).toHaveBeenCalledWith('intranet.test');
  });

  it('re-checks the scheme and userinfo of every hop', async () => {
    expect((await expandURL(`${base()}/ftp`, local)).stopped).toBe('bad-url');
    expect((await expandURL(`${base()}/userinfo`, local)).stopped).toBe('bad-url');
    expect(hits).toHaveLength(2);
  });

  it('stops after 10 hops', async () => {
    const r = await expandURL(`${base()}/loop/0`, local);
    expect(r.stopped).toBe('too-many-hops');
    expect(r.final).toBeNull();
    expect(r.hops).toHaveLength(10);
    expect(hits).toHaveLength(10);
  });

  it('times out a server that never answers within timeoutMs', async () => {
    const t0 = Date.now();
    const r = await expandURL(`${base()}/hang`, { ...local, timeoutMs: 300 });
    expect(Date.now() - t0).toBeLessThan(300 + 500);
    expect(r).toEqual({ hops: [], final: null, stopped: 'timeout' });
  });

  it('stops a chain of slow hops at the overall deadline', async () => {
    const t0 = Date.now();
    const r = await expandURL(`${base()}/slow/0`, { ...local, timeoutMs: 300, totalTimeoutMs: 700 });
    expect(Date.now() - t0).toBeLessThan(700 + 500);
    expect(r.stopped).toBe('timeout');
    expect(r.final).toBeNull();
    // The hops that did answer are kept.
    expect(r.hops.length).toBeGreaterThanOrEqual(2);
    expect(r.hops[0]).toEqual({ url: `${base()}/slow/0`, status: 302 });
  });

  it('times out a lookup that never answers', async () => {
    const lookup = vi.fn(() => new Promise<Addr[]>(() => {}));
    const t0 = Date.now();
    const r = await expandURL('http://slow.test/', { lookup, timeoutMs: 300 });
    expect(Date.now() - t0).toBeLessThan(800);
    expect(r.stopped).toBe('timeout');
  });

  it('ends at the first non-redirect', async () => {
    const r = await expandURL(`${base()}/hop1`, local);
    expect(r).toEqual({
      hops: [
        { url: `${base()}/hop1`, status: 302 },
        { url: `${base('b.test')}/hop2`, status: 307 },
        { url: `${base('c.test')}/hop3`, status: 200 }
      ],
      final: `${base('c.test')}/hop3`,
      stopped: null
    });
  });

  it('resolves a relative Location against the current hop', async () => {
    const r = await expandURL(`${base()}/dir/sub/start`, local);
    expect(r.hops.map((h) => h.url)).toEqual([`${base()}/dir/sub/start`, `${base()}/dir/next?x=1`]);
    expect(r.final).toBe(`${base()}/dir/next?x=1`);
  });

  it('sends HEAD with a plain user agent and no cookies', async () => {
    await expandURL(`${base()}/hop1`, local);
    expect(hits.map((h) => h.method)).toEqual(['HEAD', 'HEAD', 'HEAD']);
    for (const h of hits) {
      expect(h.headers['user-agent']).toBe('iksi-url-expander');
      expect(h.headers.cookie).toBeUndefined();
      expect(h.headers.authorization).toBeUndefined();
    }
  });

  it('falls back to GET on 405 and never reads the body', async () => {
    const t0 = Date.now();
    const r = await expandURL(`${base()}/nohead`, { ...local, timeoutMs: 2000 });
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(hits.map((h) => h.method)).toEqual(['HEAD', 'GET']);
    expect(r).toEqual({ hops: [{ url: `${base()}/nohead`, status: 200 }], final: `${base()}/nohead`, stopped: null });
    // The socket is dropped after the headers, not left streaming the body.
    const closed = await Promise.race([getSocketClosed.then(() => true), new Promise((r) => setTimeout(() => r(false), 500))]);
    expect(closed).toBe(true);
  });

  it('reports an unreachable host as error', async () => {
    const closed = http.createServer();
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', r));
    const p = (closed.address() as AddressInfo).port;
    await new Promise((r) => closed.close(r));
    const r = await expandURL(`http://gone.test:${p}/`, local);
    expect(r.stopped).toBe('error');
  });
});
