import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';

vi.hoisted(() => {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  });
});

import Hub from './+page.svelte';
import CompetitorPage from './[competitor]/+page.svelte';
import { load, entries } from './[competitor]/+page.js';
import { marketingPage } from '#lib/marketing/pages.js';
import { GAPS, PRODUCTS } from '#lib/marketing/facts.js';
import { alternativeCopy } from '#lib/marketing/alternatives.js';

afterEach(cleanup);

describe('/alternatives/[competitor] load', () => {
  it('throws 404 for an unknown competitor', () => {
    expect(() => load({ params: { competitor: 'foo' } })).toThrow(expect.objectContaining({ status: 404 }));
  });
  it('returns the id for a known competitor and never matches iksi', () => {
    expect(load({ params: { competitor: 'linktree' } })).toEqual({ id: 'linktree' });
    expect(() => load({ params: { competitor: 'iksi' } })).toThrow(expect.objectContaining({ status: 404 }));
  });
  it('lists every competitor in entries()', () => {
    expect(entries()).toEqual(expect.arrayContaining([{ competitor: 'linktree' }, { competitor: 'bitly' }]));
  });
});

describe('competitor page', () => {
  it('renders h1, answer, table, gaps, switch steps and FAQ in order', () => {
    const { container } = render(CompetitorPage, { props: { data: { id: 'linktree' } } });
    const copy = alternativeCopy('linktree');
    const html = container.innerHTML;
    const at = (needle) => {
      const i = html.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    const order = [
      at('<h1'),
      at(copy.answer),
      at('<table'),
      at('Where iksi falls short'),
      at('How to switch'),
      at(copy.faq[0].q)
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const g of GAPS) expect(container.textContent).toContain(g);
    for (const s of copy.switchSteps) expect(container.textContent).toContain(s);
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });
});

describe('hub page', () => {
  it('renders one table with every product as a column and linked competitor headers', () => {
    const { container } = render(Hub);
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(container.querySelectorAll('thead th[data-product]')).toHaveLength(Object.keys(PRODUCTS).length);
    for (const id of Object.keys(PRODUCTS).filter((p) => p !== 'iksi')) {
      expect(container.querySelector(`thead a[href="/alternatives/${id}"]`), id).not.toBeNull();
    }
  });
});

describe('registry', () => {
  it.each(['/alternatives', '/alternatives/linktree', '/alternatives/bitly'])('contains %s', (path) => {
    const p = marketingPage(path);
    expect(p?.kind).toBe('alternatives');
  });
  it('emits FAQ structured data built from the page copy', () => {
    const data = marketingPage('/alternatives/linktree').structuredData();
    const types = data['@graph'].map((n) => n['@type']);
    expect(types).toEqual(['WebApplication', 'FAQPage']);
    expect(data['@graph'][1].mainEntity).toHaveLength(alternativeCopy('linktree').faq.length);
  });
});
