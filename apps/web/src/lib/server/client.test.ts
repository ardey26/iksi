import { describe, it, expect } from 'vitest';
import { resolveClient, EDGE_HEADERS } from './client';

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
