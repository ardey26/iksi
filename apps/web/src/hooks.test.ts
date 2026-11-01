import { describe, it, expect } from 'vitest';
import { reroute } from './hooks';

const run = (href: string) => reroute({ url: new URL(href), fetch } as never);

describe('reroute hook', () => {
  it('maps a profile subdomain onto the @handle routes', () => {
    expect(run('https://andre.iksi.app/')).toBe('/@andre');
    expect(run('https://andre.iksi.app/sale')).toBe('/@andre/sale');
    expect(run('https://andre.iksi.app/sale+')).toBe('/@andre/sale+');
  });

  it('leaves www, admin, the apex and assets alone', () => {
    expect(run('https://www.iksi.app/@andre')).toBeUndefined();
    expect(run('https://admin.iksi.app/')).toBeUndefined();
    expect(run('https://iksi.app/sale')).toBeUndefined();
    expect(run('https://andre.iksi.app/_app/immutable/x.js')).toBeUndefined();
  });
});
