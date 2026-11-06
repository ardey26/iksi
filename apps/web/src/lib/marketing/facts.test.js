import { describe, it, expect } from 'vitest';
import { PRODUCTS, FEATURES, GAPS, newestVerified, competitorIds } from './facts.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

describe('PRODUCTS', () => {
  it('dates every product, never in the future', () => {
    for (const [id, p] of Object.entries(PRODUCTS)) {
      expect(p.verified, id).toMatch(DATE_RE);
      // Midnight UTC of the verified day must already have passed.
      expect(Date.parse(`${p.verified}T00:00:00Z`), id).toBeLessThanOrEqual(Date.now());
    }
  });

  it('gives every product a name and https links', () => {
    for (const [id, p] of Object.entries(PRODUCTS)) {
      expect(p.name, id).not.toBe('');
      expect(p.url, id).toMatch(/^https:\/\//);
      expect(p.pricingUrl, id).toMatch(/^https:\/\//);
    }
  });

  it('lists every product but iksi as a competitor', () => {
    expect(competitorIds()).toEqual(Object.keys(PRODUCTS).filter((id) => id !== 'iksi'));
    expect(competitorIds()).toContain('linktree');
    expect(competitorIds()).toContain('bitly');
  });
});

describe('FEATURES', () => {
  it('uses unique ids', () => {
    const ids = FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sources every competitor value from https', () => {
    for (const f of FEATURES) {
      for (const [id, cell] of Object.entries(f.competitors)) {
        expect(competitorIds(), `${f.id}.${id}`).toContain(id);
        expect(cell.value.trim(), `${f.id}.${id}`).not.toBe('');
        expect(cell.source, `${f.id}.${id}`).toMatch(/^https:\/\//);
      }
    }
  });

  it('gives every offered iksi feature a plan of free or paid', () => {
    for (const f of FEATURES) {
      expect(typeof f.iksi.offered, f.id).toBe('boolean');
      expect(f.iksi.value.trim(), f.id).not.toBe('');
      if (f.iksi.offered) expect(['free', 'paid'], f.id).toContain(f.iksi.plan);
      else expect(f.iksi.plan, f.id).toBeUndefined();
    }
  });

  it('promises free forever only for shortening', () => {
    const forever = FEATURES.filter((f) => f.iksi.forever === true).map((f) => f.id);
    expect(forever).toEqual(['shortening']);
  });

  it('points iksi features at feature page slugs', () => {
    for (const f of FEATURES) {
      if (f.iksi.feature !== undefined) expect(f.iksi.feature, f.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe('GAPS', () => {
  const has = (re) => GAPS.some((g) => re.test(g));

  it('admits no custom domains', () => {
    expect(has(/custom domain/i)).toBe(true);
  });
  it('admits no teams', () => {
    expect(has(/team/i)).toBe(true);
  });
  it('admits that click analytics show totals only', () => {
    // The code records country, device, browser and referrer host, but the
    // dashboard shows owners only totals (see lib/server/tracking.ts and
    // routes/(app)/dashboard). The gap says so.
    expect(GAPS.some((g) => /analytics/i.test(g) && /totals/i.test(g))).toBe(true);
  });
});

describe('newestVerified', () => {
  it('returns the latest verified date across competitors', () => {
    const dates = competitorIds().map((id) => PRODUCTS[id].verified);
    const max = dates.reduce((a, b) => (b > a ? b : a));
    expect(newestVerified()).toBe(max);
    expect(newestVerified()).toMatch(DATE_RE);
  });
});

describe('gated cells', () => {
  it('only mark cells that name a plan', () => {
    const gated = FEATURES.flatMap((f) => Object.values(f.competitors).filter((c) => c.gated));
    expect(gated.length).toBeGreaterThan(0);
    for (const c of gated) expect(c.value).toMatch(/\b(Starter|Pro|Premium|Growth|Core|paid|Enterprise)\b/);
  });
});
