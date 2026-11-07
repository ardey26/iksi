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

const IDS = ['linktree', 'bitly', 'tinyurl', 'dub', 'short-io'];

describe('/alternatives/[competitor] load', () => {
  it('throws 404 for an unknown competitor', () => {
    expect(() => load({ params: { competitor: 'foo' } })).toThrow(expect.objectContaining({ status: 404 }));
  });
  it('returns the id for a known competitor and never matches iksi', () => {
    expect(load({ params: { competitor: 'linktree' } })).toEqual({ id: 'linktree' });
    expect(() => load({ params: { competitor: 'iksi' } })).toThrow(expect.objectContaining({ status: 404 }));
  });
  it('lists every competitor in entries()', () => {
    expect(entries()).toEqual(IDS.map((competitor) => ({ competitor })));
  });
});

describe('/alternatives/[competitor] load for each competitor', () => {
  it.each(IDS)('returns the id for %s', (id) => {
    expect(load({ params: { competitor: id } })).toEqual({ id });
  });
});

describe('competitor page', () => {
  it.each(IDS)('renders h1, answer, table, gaps, switch steps and FAQ in order for %s', (id) => {
    const { container } = render(CompetitorPage, { props: { data: { id } } });
    const copy = alternativeCopy(id);
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
    expect(container.querySelector(`thead th[data-product="${id}"]`)?.textContent).toContain(PRODUCTS[id].name);
  });
});

describe('hub page', () => {
  it('renders one table with every product as a column and linked competitor headers', () => {
    const { container } = render(Hub);
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(container.querySelectorAll('thead th[data-product]')).toHaveLength(Object.keys(PRODUCTS).length);
    expect(Object.keys(PRODUCTS)).toEqual(['iksi', ...IDS]);
    for (const id of Object.keys(PRODUCTS).filter((p) => p !== 'iksi')) {
      expect(container.querySelector(`thead a[href="/alternatives/${id}"]`), id).not.toBeNull();
    }
  });
});

describe('hub layout', () => {
  it('puts the table in its own section, so the gaps section gets section spacing', () => {
    const { container } = render(Hub);
    const sections = [...container.querySelectorAll('.page-column > section.ui-section')];
    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(sections[0].querySelector('table')).not.toBeNull();
    expect(sections[1].textContent).toContain('Where iksi falls short');
  });
});

describe('hub gaps', () => {
  it('shows where iksi falls short, every gap verbatim, after the table', () => {
    const { container } = render(Hub);
    const html = container.innerHTML;
    expect(html.indexOf('Where iksi falls short')).toBeGreaterThan(html.indexOf('<table'));
    const items = [...container.querySelectorAll('section li')].map((li) => li.textContent);
    for (const g of GAPS) expect(items).toContain(g);
  });
});

describe('registry', () => {
  it.each(['/alternatives', ...IDS.map((id) => `/alternatives/${id}`)])('contains %s', (path) => {
    const p = marketingPage(path);
    expect(p?.kind).toBe('alternatives');
  });
  it('emits FAQ structured data built from the page copy', () => {
    const data = marketingPage('/alternatives/linktree').structuredData();
    const types = data['@graph'].map((n) => n['@type']);
    expect(types).toEqual(['WebApplication', 'Organization', 'FAQPage']);
    expect(data['@graph'].find((n) => n['@type'] === 'FAQPage').mainEntity).toHaveLength(alternativeCopy('linktree').faq.length);
  });
});
