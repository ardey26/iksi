import { describe, it, expect, vi, beforeEach } from 'vitest';

const rateLimit = vi.hoisted(() => vi.fn());
const checkURL = vi.hoisted(() => vi.fn());
const clientIpHash = vi.hoisted(() => vi.fn());
vi.mock('#lib/rateLimit.js', () => ({ rateLimit }));
vi.mock('#lib/server/safe-browsing.js', () => ({ checkURL }));
vi.mock('#lib/server/client.js', () => ({ clientIpHash }));
vi.mock('#lib/prisma.js', () => ({ prisma: {} }));

import { toolAllowed, toolSafeBrowsing } from './tool-limits.js';

// The real limiter's arithmetic over an in-memory counter (fixed window).
let counts: Map<string, number>;
const fakeLimiter = async (id: string, max: number) => {
  const n = (counts.get(id) ?? 0) + 1;
  counts.set(id, n);
  return n > max ? { allowed: false, remaining: 0 } : { allowed: true, remaining: max - n };
};

const event = { request: new Request('https://www.iksi.app/api/tools/check', { method: 'POST' }) } as never;

beforeEach(() => {
  vi.clearAllMocks();
  counts = new Map();
  rateLimit.mockImplementation(fakeLimiter);
  checkURL.mockResolvedValue('safe');
  clientIpHash.mockReturnValue('hash-a');
});

describe('toolAllowed', () => {
  it('allows 20 an hour per visitor, then 429', async () => {
    for (let i = 0; i < 20; i++) expect(await toolAllowed(event, 'check')).toEqual({ ok: true });
    expect(await toolAllowed(event, 'check')).toEqual({ ok: false, status: 429, error: 'Too many checks. Try again in an hour.' });
    expect(rateLimit).toHaveBeenLastCalledWith('tools:check:hash-a', 20, 3_600_000);
  });

  it('counts each tool and each visitor apart', async () => {
    for (let i = 0; i < 20; i++) await toolAllowed(event, 'check');
    expect(await toolAllowed(event, 'expand')).toEqual({ ok: true });
    expect(rateLimit).toHaveBeenLastCalledWith('tools:expand:hash-a', 20, 3_600_000);
    clientIpHash.mockReturnValue('hash-b');
    expect(await toolAllowed(event, 'check')).toEqual({ ok: true });
  });

  it('fails closed when the limiter cannot count', async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    expect((await toolAllowed(event, 'check')).ok).toBe(false);
  });

  it('fails closed when the visitor cannot be hashed', async () => {
    clientIpHash.mockImplementation(() => {
      throw new Error('SECRET_KEY must be set');
    });
    expect(await toolAllowed(event, 'check')).toMatchObject({ ok: false, status: 429 });
    expect(rateLimit).not.toHaveBeenCalled();
  });
});

describe('toolSafeBrowsing', () => {
  it('checks against the global daily budget', async () => {
    expect(await toolSafeBrowsing('https://example.com/')).toBe('safe');
    expect(rateLimit).toHaveBeenCalledWith('tools:sb:daily', 2000, 86_400_000);
    expect(checkURL).toHaveBeenCalledWith('https://example.com/');
  });

  it('returns unavailable without calling Google once the budget is spent', async () => {
    counts.set('tools:sb:daily', 2000);
    expect(await toolSafeBrowsing('https://example.com/')).toBe('unavailable');
    expect(checkURL).not.toHaveBeenCalled();
  });

  it('returns unavailable without calling Google when the budget cannot be read', async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    expect(await toolSafeBrowsing('https://example.com/')).toBe('unavailable');
    expect(checkURL).not.toHaveBeenCalled();
  });

  it.each(['malware', 'phishing', 'unwanted'])('passes %s through', async (v) => {
    checkURL.mockResolvedValue(v);
    expect(await toolSafeBrowsing('https://example.com/')).toBe(v);
  });

  it('reports a lookup that could not be made as unavailable', async () => {
    checkURL.mockResolvedValue('pending');
    expect(await toolSafeBrowsing('https://example.com/')).toBe('unavailable');
  });
});
