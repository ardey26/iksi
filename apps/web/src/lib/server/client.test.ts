import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { resolveClient, clientIpHash, EDGE_HEADERS } from './client';

const SECRET = 'edge-secret-0123456789abcdef';
const vercelIp = () => '203.0.113.9';

function headers(init: Record<string, string>) {
  return new Headers(init);
}

describe('resolveClient', () => {
  it('trusts edge headers when the shared secret matches', () => {
    const h = headers({
      [EDGE_HEADERS.secret]: SECRET,
      [EDGE_HEADERS.ip]: '198.51.100.7',
      [EDGE_HEADERS.country]: 'SG',
      'x-vercel-ip-country': 'US'
    });
    expect(resolveClient(h, SECRET, vercelIp)).toEqual({ ip: '198.51.100.7', country: 'SG' });
  });

  it('ignores edge headers when the secret is wrong', () => {
    const h = headers({
      [EDGE_HEADERS.secret]: 'guess',
      [EDGE_HEADERS.ip]: '198.51.100.7',
      [EDGE_HEADERS.country]: 'SG',
      'x-vercel-ip-country': 'US'
    });
    expect(resolveClient(h, SECRET, vercelIp)).toEqual({ ip: '203.0.113.9', country: 'US' });
  });

  it('ignores edge headers when no secret is configured', () => {
    const h = headers({
      [EDGE_HEADERS.secret]: '',
      [EDGE_HEADERS.ip]: '198.51.100.7',
      'x-vercel-ip-country': 'US'
    });
    expect(resolveClient(h, undefined, vercelIp)).toEqual({ ip: '203.0.113.9', country: 'US' });
  });

  it('falls back to the platform address when a trusted request lacks an ip', () => {
    const h = headers({ [EDGE_HEADERS.secret]: SECRET });
    expect(resolveClient(h, SECRET, vercelIp)).toEqual({ ip: '203.0.113.9', country: null });
  });

  it('survives a platform address lookup that throws', () => {
    const throwing = () => {
      throw new Error('no address');
    };
    expect(resolveClient(headers({}), SECRET, throwing)).toEqual({ ip: 'unknown', country: null });
  });
});

describe('clientIpHash', () => {
  it('is the HMAC of the visitor IP keyed with SECRET_KEY, never the IP', () => {
    const saved = process.env.SECRET_KEY;
    process.env.SECRET_KEY = 's'.repeat(32);
    try {
      const event = { request: new Request('https://www.iksi.app/'), getClientAddress: vercelIp };
      const h = clientIpHash(event);
      expect(h).toBe(createHmac('sha256', 's'.repeat(32)).update('203.0.113.9').digest('hex'));
      expect(h).not.toContain('203.0.113.9');
    } finally {
      process.env.SECRET_KEY = saved;
    }
  });
});
