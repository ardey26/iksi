import { describe, it, expect, vi, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ plan: 'free' }));
vi.mock('./facts.js', async (orig) => {
  const real = await orig();
  return {
    ...real,
    get FEATURES() {
      return real.FEATURES.map((f) =>
        f.id === 'link-in-bio' || f.id === 'shortening' ? { ...f, iksi: { ...f.iksi, plan: state.plan } } : f
      );
    }
  };
});

import { alternativeCopy, paidOnCompetitor } from './alternatives.js';
import { GAPS, FEATURES } from './facts.js';

afterEach(() => (state.plan = 'free'));

describe('alternativeCopy', () => {
  it.each(['linktree', 'bitly'])('fits search limits and names iksi for %s', (id) => {
    const c = alternativeCopy(id);
    expect(c.title.length).toBeLessThanOrEqual(60);
    expect(c.description.length).toBeLessThanOrEqual(160);
    expect(c.title.toLowerCase()).toContain('iksi');
    expect(c.description.toLowerCase()).toContain('iksi');
    expect(c.switchSteps.length).toBeGreaterThan(0);
    expect(c.faq.length).toBeGreaterThan(0);
    expect(c.answer).toContain('One tool instead of Linktree plus Bitly.');
  });

  it('says Free in the title only while the facts say free', () => {
    expect(alternativeCopy('linktree').title).toContain('Free');
    expect(alternativeCopy('bitly').title).toContain('Free');
    state.plan = 'paid';
    expect(alternativeCopy('linktree').title).not.toContain('Free');
    expect(alternativeCopy('bitly').title).not.toContain('Free');
    expect(alternativeCopy('linktree').faq[0].a).not.toMatch(/\bfree\b/i);
  });

  it('keeps hype words and middle dots out of copy', () => {
    for (const id of ['linktree', 'bitly']) {
      const text = JSON.stringify(alternativeCopy(id));
      expect(text).not.toMatch(/best|ultimate|revolutionary|·/i);
    }
  });

  it('puts every gap in the gaps FAQ answer verbatim', () => {
    const answer = alternativeCopy('linktree').faq.find((f) => /fall short/i.test(f.q)).a;
    for (const g of GAPS) expect(answer).toContain(g);
  });
});

describe('claims follow the facts', () => {
  it.each(['linktree', 'bitly'])('asks the gaps question without a competitor name for %s', (id) => {
    const q = alternativeCopy(id).faq.find((f) => /fall short/i.test(f.q)).q;
    expect(q).toBe('Where does iksi fall short?');
  });

  it('makes creating an account the first switch step for every competitor', () => {
    for (const id of ['linktree', 'bitly']) {
      expect(alternativeCopy(id).switchSteps[0]).toMatch(/Create an iksi account/);
    }
  });

  it.each(['linktree', 'bitly'])('names only facts-backed differences for %s', (id) => {
    const a = alternativeCopy(id).faq.find((f) => /different/i.test(f.q)).a;
    const backed = paidOnCompetitor(id);
    for (const f of FEATURES) {
      if (!backed.includes(f.label)) expect(a, f.label).not.toContain(f.label);
    }
    for (const label of backed) {
      const f = FEATURES.find((x) => x.label === label);
      expect(f.iksi.plan).toBe('free');
      expect(f.competitors[id].value.split('. ')[0]).toMatch(/\bneeds?\b/);
      expect(a).toContain(label);
    }
  });

  it('never claims every link can route', () => {
    for (const id of ['linktree', 'bitly']) {
      const c = alternativeCopy(id);
      expect(JSON.stringify(c)).not.toMatch(/every link can route|every row is a short link with/i);
    }
  });
});
