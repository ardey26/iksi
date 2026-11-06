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

import { alternativeCopy } from './alternatives.js';
import { GAPS } from './facts.js';

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
    expect(alternativeCopy('linktree').faq.map((f) => f.a).join(' ')).not.toMatch(/\bfree\b/i);
  });

  it('keeps hype words and middle dots out of copy', () => {
    for (const id of ['linktree', 'bitly']) {
      const text = JSON.stringify(alternativeCopy(id));
      expect(text).not.toMatch(/best|ultimate|revolutionary|·/i);
    }
  });

  it('puts every gap in the gaps FAQ answer verbatim', () => {
    const answer = alternativeCopy('linktree').faq.find((f) => /fall short|lack|not do/i.test(f.q)).a;
    for (const g of GAPS) expect(answer).toContain(g);
  });
});
