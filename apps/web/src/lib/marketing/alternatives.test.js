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
import { GAPS, FEATURES, competitorIds } from './facts.js';

const IDS = ['linktree', 'bitly', 'tinyurl', 'dub', 'short-io'];

afterEach(() => {
  state.plan = 'free';
  state.ungate = '';
});

describe('alternativeCopy', () => {
  it.each(IDS)('fits search limits and names iksi for %s', (id) => {
    const c = alternativeCopy(id);
    expect(c.title.length).toBeLessThanOrEqual(60);
    expect(c.description.length).toBeLessThanOrEqual(160);
    expect(c.title.toLowerCase()).toContain('iksi');
    expect(c.description.toLowerCase()).toContain('iksi');
    expect(c.switchSteps.length).toBeGreaterThan(0);
    expect(c.faq.length).toBeGreaterThan(0);
    expect(c.answer).toContain('One tool instead of Linktree plus Bitly.');
  });

  it('covers every competitor in the facts file', () => {
    expect(competitorIds()).toEqual(IDS);
  });

  it('says Free in the title only while the facts say free', () => {
    for (const id of IDS) expect(alternativeCopy(id).title, id).toContain('Free');
    state.plan = 'paid';
    for (const id of IDS) expect(alternativeCopy(id).title, id).not.toContain('Free');
    expect(alternativeCopy('linktree').faq[0].a).not.toMatch(/\bfree\b/i);
  });

  it('keeps hype words and middle dots out of copy', () => {
    for (const id of IDS) {
      const text = JSON.stringify(alternativeCopy(id));
      expect(text).not.toMatch(/best|ultimate|revolutionary|·/i);
    }
  });

  it.each(IDS)('puts every gap in the gaps FAQ answer verbatim for %s', (id) => {
    const answer = alternativeCopy(id).faq.find((f) => /fall short/i.test(f.q)).a;
    for (const g of GAPS) expect(answer).toContain(g);
  });

  it.each(['tinyurl', 'dub', 'short-io'])('names the competitor in the title and switch steps for %s', (id) => {
    const c = alternativeCopy(id);
    const name = { tinyurl: 'TinyURL', dub: 'Dub', 'short-io': 'Short.io' }[id];
    expect(c.title).toContain(`${name} alternative`);
    expect(c.switchSteps.join(' ')).toContain(`your ${name} links`);
  });
});

describe('claims follow the facts', () => {
  it.each(IDS)('asks the gaps question without a competitor name for %s', (id) => {
    const q = alternativeCopy(id).faq.find((f) => /fall short/i.test(f.q)).q;
    expect(q).toBe('Where does iksi fall short?');
  });

  it('makes creating an account the first switch step for every competitor', () => {
    for (const id of IDS) {
      expect(alternativeCopy(id).switchSteps[0]).toMatch(/Create an iksi account/);
    }
  });

  it.each(IDS)('quotes every gated cell verbatim and no other cell for %s', (id) => {
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

  it.each(IDS)('pairs each free iksi feature with its quoted %s cell', (id) => {
    const name = { linktree: 'Linktree', bitly: 'Bitly', tinyurl: 'TinyURL', dub: 'Dub', 'short-io': 'Short.io' }[id];
    const a = alternativeCopy(id).faq.find((f) => /different/i.test(f.q)).a;
    for (const g of gatedOnCompetitor(id)) {
      const value = /[.!?]$/.test(g.value) ? g.value : `${g.value}.`;
      expect(a).toContain(`Free on iksi: ${g.label}. On ${name}: ${value}`);
    }
    expect(a).not.toMatch(/Free on iksi: [^.]*;/);
  });

  it('does not compare iksi payments with Linktree products or bookings', () => {
    const a = alternativeCopy('linktree').faq.find((f) => /different/i.test(f.q)).a;
    expect(a).not.toContain('Paid products and bookings');
    expect(a).not.toContain('Payments on your profile');
  });

  it('leaves out a feature whose cell is not gated', () => {
    state.ungate = 'password';
    const a = alternativeCopy('linktree').faq.find((f) => /different/i.test(f.q)).a;
    expect(a).not.toContain('Password and code lock need Pro');
    expect(a).not.toContain('Password-protected links');
    expect(a).toContain('Custom back-halves need Starter');
  });

  it('never claims every link can route', () => {
    for (const id of IDS) {
      const c = alternativeCopy(id);
      expect(JSON.stringify(c)).not.toMatch(/every link can route|every row is a short link with/i);
    }
  });
});
