import { describe, it, expect, vi, beforeEach } from 'vitest';

const rateLimit = vi.hoisted(() => vi.fn());
const checkURL = vi.hoisted(() => vi.fn());
const clientIpHash = vi.hoisted(() => vi.fn());
const expandURL = vi.hoisted(() => vi.fn());
// Records every property read on prisma, so a test can prove the tools never
// reach the link tables or the click counters.
const prismaReads = vi.hoisted(() => [] as string[]);
vi.mock('#lib/prisma.js', () => ({
  prisma: new Proxy({}, { get: (_t, key) => (prismaReads.push(String(key)), new Proxy(() => {}, { get: () => vi.fn() })) })
}));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit }));
vi.mock('#lib/server/safe-browsing.js', () => ({ checkURL }));
vi.mock('#lib/server/client.js', () => ({ clientIpHash }));
vi.mock('#lib/server/expand.js', () => ({ expandURL }));

import { POST as check, config as checkConfig } from './check/+server.js';
import { POST as expand, config as expandConfig } from './expand/+server.js';

let counts: Map<string, number>;
const fakeLimiter = async (id: string, max: number) => {
  const n = (counts.get(id) ?? 0) + 1;
  counts.set(id, n);
  return n > max ? { allowed: false, remaining: 0 } : { allowed: true, remaining: max - n };
};

const call = (handler: typeof check, body: BodyInit, headers: Record<string, string> = {}) =>
  handler({
    request: new Request('https://www.iksi.app/api/tools/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body
    }),
    getClientAddress: () => '203.0.113.9'
  } as never);
const post = (handler: typeof check, body: unknown) => call(handler, JSON.stringify(body));

const EXPANDED = {
  hops: [
    { url: 'https://bit.ly/abc', status: 301 },
    { url: 'https://example.com/', status: 200 }
  ],
  final: 'https://example.com/',
  stopped: null
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaReads.length = 0;
  counts = new Map();
  rateLimit.mockImplementation(fakeLimiter);
  checkURL.mockResolvedValue('safe');
  clientIpHash.mockReturnValue('hash-a');
  expandURL.mockResolvedValue(EXPANDED);
});

describe.each([
  ['check', check, 'check', checkConfig],
  ['expand', expand, 'expand', expandConfig]
] as const)('POST /api/tools/%s', (_name, handler, tool, config) => {
  it('is never cached', async () => {
    expect((await post(handler, { url: 'https://example.com' })).headers.get('cache-control')).toBe('no-store');
    expect((await post(handler, { url: 42 })).headers.get('cache-control')).toBe('no-store');
  });

  it.each([42, null, undefined, ['https://example.com'], { href: 'x' }])('refuses url %j with 400', async (url) => {
    const res = await post(handler, { url });
    expect(res.status).toBe(400);
    expect(checkURL).not.toHaveBeenCalled();
    expect(expandURL).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON', async () => {
    expect((await call(handler, 'not json')).status).toBe(400);
  });

  it('refuses a body over 4 KB by its content-length', async () => {
    const res = await call(handler, JSON.stringify({ url: 'https://example.com' }), { 'content-length': '5000' });
    expect(res.status).toBe(400);
  });

  it('refuses a body over 4 KB that understates its length', async () => {
    const body = JSON.stringify({ url: 'https://example.com', pad: 'x'.repeat(5000) });
    const res = await call(handler, body, { 'content-length': '10' });
    expect(res.status).toBe(400);
    expect(checkURL).not.toHaveBeenCalled();
    expect(expandURL).not.toHaveBeenCalled();
  });

  it('refuses a streamed body over 4 KB with no content-length', async () => {
    // Valid JSON, so only the size cap can refuse it.
    const parts = ['{"url":"https://example.com","pad":"', ...Array(6).fill('x'.repeat(1024)), '"}'];
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      pull(c) {
        const next = parts.shift();
        if (next === undefined) c.close();
        else c.enqueue(enc.encode(next));
      }
    });
    const res = await handler({
      request: new Request('https://www.iksi.app/api/tools/x', { method: 'POST', body: stream, duplex: 'half' } as RequestInit),
      getClientAddress: () => '203.0.113.9'
    } as never);
    expect(res.status).toBe(400);
    expect(checkURL).not.toHaveBeenCalled();
    expect(expandURL).not.toHaveBeenCalled();
  });

  it('returns 429 on the 21st call in an hour from one visitor', async () => {
    for (let i = 0; i < 20; i++) expect((await post(handler, { url: 'https://example.com' })).status).toBe(200);
    const res = await post(handler, { url: 'https://example.com' });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Too many checks. Try again in an hour.' });
    expect(rateLimit).toHaveBeenCalledWith(`tools:${tool}:hash-a`, 20, 3_600_000);
  });

  it('does not spend the Safe Browsing budget on a refused visitor', async () => {
    counts.set(`tools:${tool}:hash-a`, 20);
    await post(handler, { url: 'https://example.com' });
    expect(counts.has('tools:sb:daily')).toBe(false);
    expect(checkURL).not.toHaveBeenCalled();
  });

  it('answers unavailable without calling Google once the daily budget is spent', async () => {
    counts.set('tools:sb:daily', 2000);
    const res = await post(handler, { url: 'https://example.com' });
    expect(res.status).toBe(200);
    expect((await res.json()).verdict).toBe('unavailable');
    expect(checkURL).not.toHaveBeenCalled();
  });

  it('answers unavailable when Safe Browsing does not answer within 3 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      checkURL.mockReturnValue(new Promise(() => {}));
      const pending = post(handler, { url: 'https://example.com' });
      await vi.advanceTimersByTimeAsync(3000);
      const res = await pending;
      expect(res.status).toBe(200);
      expect((await res.json()).verdict).toBe('unavailable');
    } finally {
      vi.useRealTimers();
    }
  });

  it('caps the function at 20 seconds', () => {
    expect(config).toEqual({ maxDuration: 20 });
  });

  it('never touches the database directly', async () => {
    await post(handler, { url: 'https://example.com' });
    await post(handler, { url: 42 });
    expect(prismaReads).toEqual([]);
  });
});

describe('POST /api/tools/check', () => {
  it('returns the verdict for the link', async () => {
    checkURL.mockResolvedValue('phishing');
    const res = await post(check, { url: 'example.com/login' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verdict: 'phishing' });
    expect(checkURL).toHaveBeenCalledWith('https://example.com/login');
  });

  it.each(['javascript:alert(1)', 'ftp://example.com', '', '   ', 'https://', 'a'.repeat(2049)])(
    'refuses %j with 400',
    async (url) => {
      expect((await post(check, { url })).status).toBe(400);
      expect(checkURL).not.toHaveBeenCalled();
    }
  );
});

describe('POST /api/tools/expand', () => {
  it('returns the hops and the verdict for the final destination', async () => {
    checkURL.mockResolvedValue('malware');
    const res = await post(expand, { url: 'bit.ly/abc' });
    expect(await res.json()).toEqual({ ...EXPANDED, verdict: 'malware' });
    expect(checkURL).toHaveBeenCalledWith('https://example.com/');
  });

  it('never passes the test-only loopback flag', async () => {
    await post(expand, { url: 'bit.ly/abc' });
    expect(expandURL).toHaveBeenCalledTimes(1);
    const [input, opts] = expandURL.mock.calls[0];
    expect(input).toBe('bit.ly/abc');
    expect(opts?.allowLoopbackForTest).toBeUndefined();
    expect(opts?.lookup).toBeUndefined();
  });

  it.each(['javascript:alert(1)', 'ftp://example.com', '', '   ', 'https://', 'a'.repeat(2049)])(
    'refuses unusable url #%# with 400 before spending the visitor limit',
    async (url) => {
      expect((await post(expand, { url })).status).toBe(400);
      expect(rateLimit).not.toHaveBeenCalled();
      expect(expandURL).not.toHaveBeenCalled();
    }
  );

  it('skips Safe Browsing when there is no final destination', async () => {
    expandURL.mockResolvedValue({ hops: [], final: null, stopped: 'blocked' });
    const res = await post(expand, { url: 'http://169.254.169.254/' });
    expect(await res.json()).toEqual({ hops: [], final: null, stopped: 'blocked', verdict: null });
    expect(checkURL).not.toHaveBeenCalled();
  });
});
