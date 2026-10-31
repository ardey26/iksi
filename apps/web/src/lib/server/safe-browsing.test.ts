import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkURL } from './safe-browsing';

const originalFetch = global.fetch;
const originalKey = process.env.SAFE_BROWSING_API_KEY;

beforeEach(() => {
  process.env.SAFE_BROWSING_API_KEY = 'test-key';
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.SAFE_BROWSING_API_KEY;
  else process.env.SAFE_BROWSING_API_KEY = originalKey;
});

describe('checkURL', () => {
  it('returns "safe" when API returns no matches', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as any;
    const v = await checkURL('https://example.com');
    expect(v).toBe('safe');
  });

  it('returns "malware" for MALWARE threat type', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      matches: [{ threatType: 'MALWARE' }]
    }), { status: 200 })) as any;
    const v = await checkURL('https://bad.example');
    expect(v).toBe('malware');
  });

  it('returns "phishing" for SOCIAL_ENGINEERING', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      matches: [{ threatType: 'SOCIAL_ENGINEERING' }]
    }), { status: 200 })) as any;
    expect(await checkURL('https://phish.example')).toBe('phishing');
  });

  it('returns "unwanted" for UNWANTED_SOFTWARE', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      matches: [{ threatType: 'UNWANTED_SOFTWARE' }]
    }), { status: 200 })) as any;
    expect(await checkURL('https://pua.example')).toBe('unwanted');
  });

  it('returns "pending" when no API key set', async () => {
    delete process.env.SAFE_BROWSING_API_KEY;
    const v = await checkURL('https://example.com');
    expect(v).toBe('pending');
  });

  it('returns "pending" when API errors', async () => {
    global.fetch = vi.fn(async () => new Response('boom', { status: 500 })) as any;
    expect(await checkURL('https://example.com')).toBe('pending');
  });

  it('returns "pending" when fetch throws', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network'); }) as any;
    expect(await checkURL('https://example.com')).toBe('pending');
  });
});
