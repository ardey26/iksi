import { describe, it, expect, beforeEach } from 'vitest';
import { requestContext } from './request-context';

function ev(headers: Record<string, string> = {}) {
  return { request: new Request('https://www.iksi.app/AbC', { headers }) } as never;
}

beforeEach(() => {
  process.env.EDGE_SECRET = 'edge';
});

describe('requestContext', () => {
  it('reads country, continent, device, os and referrer host', () => {
    const ctx = requestContext(
      ev({
        'x-iksi-edge': 'edge',
        'x-iksi-client-country': 'SG',
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        referer: 'https://www.Example.com/page?x=1'
      }),
      123
    );
    expect(ctx).toMatchObject({
      country: 'SG',
      continent: 'AS',
      device: 'mobile',
      os: 'ios',
      referrerHost: 'example.com',
      now: 123
    });
  });

  it('degrades to nulls and defaults with no UA, referer or country', () => {
    const ctx = requestContext(ev(), 5);
    expect(ctx.country).toBeNull();
    expect(ctx.continent).toBeNull();
    expect(ctx.referrerHost).toBeNull();
    expect(ctx.device).toBe('desktop');
    expect(ctx.now).toBe(5);
  });

  it('ignores edge country headers without the secret', () => {
    const ctx = requestContext(ev({ 'x-iksi-client-country': 'SG' }), 1);
    expect(ctx.country).toBeNull();
  });
});
