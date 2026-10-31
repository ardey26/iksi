import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkURL, checkURLs } from './safe-browsing';

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

describe('checkURLs', () => {
  const sent = (f: any) => JSON.parse(f.mock.calls[0][1].body).threatInfo.threatEntries;

  it('looks every URL up in one request, deduped', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    global.fetch = f as any;
    const v = await checkURLs(['https://a.example/', 'https://b.example/', 'https://a.example/']);
    expect(v).toBe('safe');
    expect(f).toHaveBeenCalledTimes(1);
    expect(sent(f)).toEqual([{ url: 'https://a.example/' }, { url: 'https://b.example/' }]);
  });

  it('the worst match wins, whichever URL it is on', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      matches: [
        { threatType: 'UNWANTED_SOFTWARE', threat: { url: 'https://b.example/' } },
        { threatType: 'MALWARE', threat: { url: 'https://c.example/' } },
        { threatType: 'SOCIAL_ENGINEERING', threat: { url: 'https://d.example/' } }
      ]
    }), { status: 200 })) as any;
    expect(await checkURLs(['https://a.example/', 'https://b.example/', 'https://c.example/'])).toBe('malware');
  });

  it('phishing beats unwanted', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      matches: [{ threatType: 'UNWANTED_SOFTWARE' }, { threatType: 'SOCIAL_ENGINEERING' }]
    }), { status: 200 })) as any;
    expect(await checkURLs(['https://a.example/', 'https://b.example/'])).toBe('phishing');
  });

  it('is safe with no URLs and makes no request', async () => {
    const f = vi.fn();
    global.fetch = f as any;
    expect(await checkURLs([])).toBe('safe');
    expect(f).not.toHaveBeenCalled();
  });
});
