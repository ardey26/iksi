import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkedCaption, formatDay } from '#lib/marketing/facts.js';
import { render, cleanup } from '@testing-library/svelte';

const state = vi.hoisted(() => ({ linkInBioPlan: 'free' }));
vi.mock('#lib/marketing/facts.js', async (orig) => {
  const real = await orig();
  return {
    ...real,
    get FEATURES() {
      return real.FEATURES.map((f) =>
        f.id === 'link-in-bio' ? { ...f, iksi: { ...f.iksi, plan: state.linkInBioPlan } } : f
      );
    }
  };
});

import ComparisonTable from './ComparisonTable.svelte';
import { FEATURES, PRODUCTS } from '#lib/marketing/facts.js';

afterEach(() => {
  cleanup();
  state.linkInBioPlan = 'free';
});

const cell = (container, feature, product) =>
  container.querySelector(`tr[data-feature="${feature}"] td[data-product="${product}"]`);

describe('ComparisonTable', () => {
  it('marks every competitor link nofollow', () => {
    const { container } = render(ComparisonTable, { props: { columns: ['iksi', 'linktree'] } });
    const links = container.querySelectorAll('td[data-product="linktree"] a');
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a.getAttribute('rel')).toContain('nofollow');
  });

  it('reads Free for free iksi features and Free forever for shortening', () => {
    const { container } = render(ComparisonTable, { props: { columns: ['iksi', 'linktree'] } });
    for (const f of FEATURES.filter((f) => f.iksi.offered && f.iksi.plan === 'free' && !f.iksi.forever)) {
      expect(cell(container, f.id, 'iksi').textContent, f.id).toMatch(/\bFree\b/);
      expect(cell(container, f.id, 'iksi').textContent, f.id).not.toContain('Free forever');
    }
    expect(cell(container, 'shortening', 'iksi').textContent).toContain('Free forever');
  });

  it('reads Not offered for features iksi lacks', () => {
    const { container } = render(ComparisonTable, { props: { columns: ['iksi', 'linktree'] } });
    expect(cell(container, 'teams', 'iksi').textContent).toContain('Not offered');
    expect(cell(container, 'teams', 'iksi').textContent).not.toContain('Free');
  });

  it('says the shared date once when every product was checked the same day', () => {
    expect(checkedCaption(['iksi', 'linktree'], {
      iksi: { name: 'iksi', verified: '2026-11-06' },
      linktree: { name: 'Linktree', verified: '2026-11-06' }
    })).toBe('Checked Nov 6, 2026.');
  });
  it('names each product when the checked dates differ', () => {
    expect(checkedCaption(['iksi', 'linktree'], {
      iksi: { name: 'iksi', verified: '2026-11-06' },
      linktree: { name: 'Linktree', verified: '2026-10-01' }
    })).toBe('iksi checked Nov 6, 2026. Linktree checked Oct 1, 2026.');
  });
  it('shows the verified date for each product in the caption', () => {
    const { container } = render(ComparisonTable, { props: { columns: ['iksi', 'linktree', 'bitly'] } });
    const caption = container.querySelector('caption').textContent;
    expect(caption.trim()).toBe(checkedCaption(['iksi', 'linktree', 'bitly']));
    expect(caption).toContain(formatDay(PRODUCTS.linktree.verified));
  });

  it('renders Not listed with no link for a missing competitor value', () => {
    const { container } = render(ComparisonTable, { props: { columns: ['iksi', 'linktree'] } });
    const c = cell(container, 'ab-split', 'linktree');
    expect(c.textContent).toContain('Not listed');
    expect(c.querySelector('a')).toBeNull();
  });

  it('does not read Free for a paid iksi feature', () => {
    state.linkInBioPlan = 'paid';
    const { container } = render(ComparisonTable, { props: { columns: ['iksi', 'linktree'] } });
    const text = cell(container, 'link-in-bio', 'iksi').textContent;
    expect(text).toContain('Paid');
    expect(text).not.toMatch(/Free/);
  });

  it('links competitor headers only when asked', () => {
    const a = render(ComparisonTable, { props: { columns: ['iksi', 'linktree'] } });
    expect(a.container.querySelector('thead a')).toBeNull();
    cleanup();
    const b = render(ComparisonTable, { props: { columns: ['iksi', 'linktree'], linkHeaders: true } });
    expect(b.container.querySelector('thead a[href="/alternatives/linktree"]')).not.toBeNull();
    expect(b.container.querySelector('thead a[href="/alternatives/iksi"]')).toBeNull();
  });

  it('widens the table with the number of columns so cells stay readable', () => {
    const two = render(ComparisonTable, { props: { columns: ['iksi', 'linktree'] } });
    expect(two.container.querySelector('table').getAttribute('style')).toContain('--columns: 2');
    cleanup();
    const six = render(ComparisonTable, { props: { columns: ['iksi', 'linktree', 'bitly', 'tinyurl', 'dub', 'short-io'] } });
    expect(six.container.querySelector('table').getAttribute('style')).toContain('--columns: 6');
    expect(six.container.querySelectorAll('thead th[data-product]')).toHaveLength(6);
  });

  it('labels every value cell with its product name, for the phone layout', () => {
    const columns = ['iksi', 'linktree', 'bitly'];
    const { container } = render(ComparisonTable, { props: { columns } });
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(FEATURES.length);
    expect(container.querySelectorAll('thead th[data-product]')).toHaveLength(columns.length);
    const cells = container.querySelectorAll('tbody td');
    expect(cells).toHaveLength(FEATURES.length * columns.length);
    for (const td of cells) expect(td.getAttribute('data-label')).toBe(PRODUCTS[td.getAttribute('data-product')].name);
  });

  it('keeps table semantics with explicit roles, for the restacked phone layout', () => {
    const { container } = render(ComparisonTable, { props: { columns: ['iksi', 'linktree'] } });
    const q = (sel) => container.querySelectorAll(sel);
    expect(q('table[role="table"]')).toHaveLength(1);
    expect(q('thead[role="rowgroup"]')).toHaveLength(1);
    expect(q('tbody[role="rowgroup"]')).toHaveLength(1);
    expect(q('tr[role="row"]')).toHaveLength(FEATURES.length + 1);
    expect(q('tr:not([role="row"])')).toHaveLength(0);
    expect(q('thead th[role="columnheader"]')).toHaveLength(3);
    expect(q('tbody th[role="rowheader"]')).toHaveLength(FEATURES.length);
    expect(q('tbody td[role="cell"]')).toHaveLength(FEATURES.length * 2);
  });
});
