import { describe, it, expect, vi, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ plan: 'free', ungate: '' }));
vi.mock('./facts.js', async (orig) => {
  const real = await orig();
  return {
    ...real,
    get FEATURES() {
      return real.FEATURES.map((f) => {
        if (f.id === state.ungate) {
          const competitors = Object.fromEntries(
            Object.entries(f.competitors).map(([k, c]) => [k, { value: c.value, source: c.source }])
          );
          return { ...f, competitors };
        }
        return f.id === 'link-in-bio' || f.id === 'shortening' ? { ...f, iksi: { ...f.iksi, plan: state.plan } } : f;
      });
    }
  };
});

import { alternativeCopy, gatedOnCompetitor } from './alternatives.js';
import { GAPS, FEATURES } from './facts.js';

afterEach(() => {
  state.plan = 'free';
  state.ungate = '';
});

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

  it.each(['linktree', 'bitly'])('quotes every gated cell verbatim and no other cell for %s', (id) => {
    const a = alternativeCopy(id).faq.find((f) => /different/i.test(f.q)).a;
    const gated = gatedOnCompetitor(id);
    expect(gated.length).toBeGreaterThan(0);
    for (const f of FEATURES) {
      const cell = f.competitors[id];
      if (!cell) continue;
      if (cell.gated && f.iksi.offered && f.iksi.plan === 'free') expect(a, f.id).toContain(cell.value);
      else expect(a, f.id).not.toContain(cell.value);
    }
  });

  it('leaves out a feature whose cell is not gated', () => {
    state.ungate = 'password';
    const a = alternativeCopy('linktree').faq.find((f) => /different/i.test(f.q)).a;
    expect(a).not.toContain('Password and code lock need Pro');
    expect(a).not.toContain('Password-protected links');
    expect(a).toContain('Custom back-halves need Starter');
  });

  it('never claims every link can route', () => {
    for (const id of ['linktree', 'bitly']) {
      const c = alternativeCopy(id);
      expect(JSON.stringify(c)).not.toMatch(/every link can route|every row is a short link with/i);
    }
  });
});
