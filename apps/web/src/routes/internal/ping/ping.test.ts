import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './+server';

function call(headers: Record<string, string> = {}) {
  const url = new URL('https://www.iksi.app/internal/ping');
  return GET({ url, request: new Request(url, { headers }) } as never);
}

beforeEach(() => {
  process.env.EDGE_SECRET = 'edge';
});

describe('GET /internal/ping', () => {
  it('204s for a matching x-iksi-internal', async () => {
    const res = await call({ 'x-iksi-internal': 'edge' });
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it.each([
    ['no header', {}],
    ['a wrong secret', { 'x-iksi-internal': 'nope' }],
    ['x-iksi-edge alone', { 'x-iksi-edge': 'edge' }]
  ])('401s for %s', async (_name, headers) => {
    const res = await call(headers);
    expect(res.status).toBe(401);
  });

  it('401s when EDGE_SECRET is not configured', async () => {
    delete process.env.EDGE_SECRET;
    const res = await call({ 'x-iksi-internal': '' });
    expect(res.status).toBe(401);
  });
});
