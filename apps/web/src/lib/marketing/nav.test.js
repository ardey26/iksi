import { describe, it, expect } from 'vitest';
import { MARKETING_NAV, isMarketingPath } from './nav.js';
import { MARKETING_PAGES } from './pages.js';
import layoutSource from '/src/routes/+layout.svelte?raw';
import footerSource from '/src/lib/components/SiteFooter.svelte?raw';
import navSource from './nav.js?raw';
import seoSource from '/src/lib/seo/routes.js?raw';

describe('MARKETING_NAV', () => {
  it('lists the same pages as the full registry, with the same labels and kinds', () => {
    const slim = (p) => ({ path: p.path, label: p.label, kind: p.kind });
    expect(MARKETING_NAV.map(slim)).toEqual(MARKETING_PAGES.map(slim));
  });
  it('carries no copy', () => {
    for (const p of MARKETING_NAV) expect(Object.keys(p).sort()).toEqual(['kind', 'label', 'path']);
  });
  it('tells marketing paths apart', () => {
    expect(isMarketingPath('/tools/qr-code')).toBe(true);
    expect(isMarketingPath('/tools')).toBe(false);
    expect(isMarketingPath('/abc')).toBe(false);
  });
});

// Every page ships the root layout, profiles included; the facts and FAQ copy
// must load only on the marketing pages that use them.
describe('root layout bundle', () => {
  const heavy = /marketing\/(pages|facts|alternatives|features|qr-tool|link-tools)(\.js)?['"]/;
  it.each([
    ['+layout.svelte', layoutSource],
    ['SiteFooter.svelte', footerSource],
    ['nav.js', navSource],
    ['seo/routes.js', seoSource]
  ])('%s imports no marketing copy', (_, source) => {
    expect(source).not.toMatch(heavy);
  });
});
